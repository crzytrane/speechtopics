import { jsxRenderer } from 'hono/jsx-renderer'

export const renderer = jsxRenderer(({ children, title }) => {
  return (
    <html>
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>{title}</title>
        <link href="/static/style.css" rel="stylesheet"/>
        <script src="/static/htmx.min.js"></script>
        <link rel="icon" href="/static/favicon.ico" type="image/x-icon"/>
      </head>
      <body hx-boost="true" class="font-sans grid h-screen">{children}</body>
    </html>
  )
})
