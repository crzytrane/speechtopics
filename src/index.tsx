import { Hono } from 'hono'
import { FC } from 'hono/jsx'
import { renderer } from './renderer'
import { D1Database, Queue, Ai } from '@cloudflare/workers-types';

type Bindings = {
  AI: Ai;
  DB: D1Database;
  EMAIL_QUEUE: Queue
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

const OnelineMessage: FC = ({ children }) => {
  return (<div class="place-self-center grid gap-2 p-8">
    <div class="place-self-center justify-center">{children}</div>
    <a href="/" class="place-self-center justify-center text-blue-500">Show topic</a>
  </div>)
}

app.get('/api', async (c) => {
  const result = await c.env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", {
    max_tokens: 50,
    temperature: 1,
    messages: [
      { role: "system", content: "You give creative topics for impromptu speaking. You only respond with the topic when asked. Without quotes. In the format of a question"},
      { role: "user", content: "Give me a one liner topic in the format of a question"}
    ],
  }) as any;

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

  if (value !== null && !value.confirmed) {
    await c.env.EMAIL_QUEUE.send({ type: 'subscribe', email: email, code: value.code });
    return c.html("Confirmation pending. Email has been resent", { status: 200 })
  }

  const code = crypto.randomUUID()

  await c.env.DB
    .prepare(`insert into MailingList (email, code) values (?, ?)`)
    .bind(email, code)
    .run();

  await c.env.EMAIL_QUEUE.send({ type: 'subscribe', email: email, code: code });

  return c.html("Confirmation email sent")
})

app.get('/mailinglist/unsubscribe', async (c) => {
  const { email, code } = c.req.query()

  if (!email || email === "") {
    return c.render(<OnelineMessage>Email is required</OnelineMessage>)
  }

  if (!code || code === "") {
    return c.render(<OnelineMessage>Code is required</OnelineMessage>)
  }

  const row = await c.env.DB.prepare('select * from MailingList where email = ? and code = ?').bind(email, code).first()

  if (!row) {
    return c.render(<OnelineMessage>Email not found</OnelineMessage>)
  }

  if (row.code !== code) {
    return c.render(<OnelineMessage>Invalid code</OnelineMessage>)
  }

  await c.env.DB
  .prepare(`delete from MailingList where email = ?`)
  .bind(email)
  .run();

  return c.render(<OnelineMessage>You have been unsubscribed from the mailing list</OnelineMessage>)
})

app.get('/mailinglist/verify', async (c) => {
  const { email, code } = c.req.query()

  if (!email || email === "") {
    return c.render(<OnelineMessage>Email is required</OnelineMessage>)
  }

  if (!code || code === "") {
    return c.render(<OnelineMessage>Code is required</OnelineMessage>)
  }

  const row = await c.env.DB.prepare('select * from MailingList where email = ? and code = ?')
    .bind(email, code)
    .first()

  if (!row) {
    return c.render(<OnelineMessage>Email not found</OnelineMessage>)
  }

  if (row.confirmed) {
    return c.render(<OnelineMessage>Email already confirmed</OnelineMessage>)
  }

  if (row.code !== code) {
    return c.render(<OnelineMessage>Invalid code</OnelineMessage>)
  }

  await c.env.DB.prepare(`update MailingList set confirmed = 1 where email = ? and code = ?`)
  .bind(email, code)
  .run();

  await c.env.EMAIL_QUEUE.send({ type: 'subscribe', email, code });

  return c.render(<OnelineMessage>You have been subscribed to the mailing list</OnelineMessage>)
})

app.get('health', async (c) => {
  return c.json({ status: 'ok' }, 200)
})

export default app
