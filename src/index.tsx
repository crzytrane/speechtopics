import { Hono } from 'hono'
import { renderer } from './renderer'
import { Queue } from '@cloudflare/workers-types';

type Bindings = {
  AI: any;
  DB: D1Database;
  EMAIL_ENROLLMENT_QUEUE: Queue
}

const app = new Hono<{ Bindings: Bindings }>()

app.use(renderer)

app.get('/', (c) => {
  return c.render(
    <>
      <div class="place-self-center grid gap-2 p-8">
        <div class="text-3xl text-center">Speech topics</div>
        <div id="content" hx-get="/api" hx-trigger="load" class="place-self-center justify-center">Loading...</div>
      </div>
      <div class="place-self-center">
        <form hx-post="/api/mailinglist/subscribe" hx-target="this">
          <div class="px-4 place-self-center justify-center">Daily mailing list</div>
          <input type="email" name="email" placeholder="Enter your email" class="rounded-md p-2 px-4 border-black" />
          <button type="submit" class="rounded-md p-2 px-4 border-black bg-gray-100 shadow-gray-100">Subscribe</button>
        </form>
      </div>
  </>, { title: 'Speech topics' })
})


app.get('/api', async (c) => {
  const result = await c.env.AI.run("@cf/meta/llama-3-8b-instruct", {
    max_tokens: 50,
    messages: [
      { role: "system", content: "You give creative topics for impromptu speaking. You only respond with the topic when asked. Without quotes. In the format of a question"},
      { role: "user", content: "Give me a one liner topic in the format of a question"}
    ],
  });

  const payload = result.response.trim()

  return c.html(payload);
})

app.post('/api/mailinglist/subscribe', async (c) => {
  const formData = await c.req.formData()
  const email = formData.get("email")

  if (!email || email === "") {
    return c.html("Email is required", { status: 400 })
  }

  const value = await c.env.DB.prepare('select * from MailingList where email = ?').bind(email).first()

  if (value !== null && value.confirmed) {
    return c.html("You are already subscribed", { status: 200 })
  }

  const code = crypto.randomUUID()

  if (value !== null && !value.confirmed) {
    await c.env.EMAIL_ENROLLMENT_QUEUE.send({ type: 'subscribe', email: email, code: code });
    return c.html("Confirmation pending. Email has been resent", { status: 200 })
  }

  await c.env.DB
    .prepare(`insert into MailingList (email, code) values (?, ?)`)
    .bind(email, code)
    .run();

  await c.env.EMAIL_ENROLLMENT_QUEUE.send({ type: 'subscribe', email: email, code: code });

  return c.html("Confirmation email sent. Confirmation link expires in 15 minutes")
})

app.get('/api/mailinglist/unsubscribe', async (c) => {
  const { email, code } = c.req.query()

  if (!email || email === "") {
    return c.html("Email is required", { status: 400 })
  }

  if (!code || code === "") {
    return c.html("Code is required", { status: 400 })
  }

  const row = await c.env.DB.prepare('select * from MailingList where email = ?').bind(email).first()

  if (!row) {
    return c.html("Email not found", { status: 400 })
  }

  if (row.confirmed) {
    return c.html("Email already confirmed", { status: 400 })
  }

  if (row.code !== code) {
    return c.html("Invalid code", { status: 400 })
  }

  await c.env.DB
  .prepare(`delete from MailingList where email = ?`)
  .bind(email)
  .run();

  return c.html("You have been unsubscribed from the mailing list")
})

app.get('/api/mailinglist/verify', async (c) => {
  const { email, code } = c.req.query()

  if (!email || email === "") {
    return c.html("Email is required", { status: 400 })
  }

  if (!code || code === "") {
    return c.html("Code is required", { status: 400 })
  }

  const row = await c.env.DB.prepare('select * from MailingList where email = ? and code = ?')
    .bind(email, code)
    .first()

  if (!row) {
    return c.html("Email not found", { status: 400 })
  }

  if (row.confirmed) {
    return c.html("Email already confirmed", { status: 400 })
  }

  if (row.code !== code) {
    return c.html("Invalid code", { status: 400 })
  }

  await c.env.DB
  .prepare(`update MailingList set confirmed = 1 where email = ? and code = ?`)
  .bind(email, code)
  .run();

  await c.env.EMAIL_ENROLLMENT_QUEUE.send({ type: 'subscribe', email, code });

  return c.html("Confirmation email sent. Confirmation link expires in 15 minutes")
})

export default app
