import Koa from 'koa'
import koaBody from 'koa-body'
import session from 'koa-session'
import {
  hasSessionCookieMiddleware,
  recoveryFormMiddleware,
  createSessionState,
} from '@renoirb/koa-middleware-utils'

const AS_IF_WE_VALIDATED = '111.222.333'
const SESSION_KEY = 'bff'

/** @type {import('@renoirb/koa-middleware-utils').IHasSessionCookieMiddlewareOptions} */
const CONFIG_HAS_SESSION = {
  cookieName: SESSION_KEY,
}
/** @type {import('@renoirb/koa-middleware-utils').IRecoveryFormMiddlewareOptions} */
const CONFIG_SESSION_RECOVERY = {
  baseApi: '/bff',
  recoveryPath: '/recovery',
  redirect: '/bff/whois',
}

// BEGIN Example
// https://github.com/koajs/session#example
const app = new Koa()
app.keys = ['some secret hurr']
app.use(
  session(
    {
      httpOnly: true,
      signed: true,
      key: SESSION_KEY,
    },
    app,
  ),
)
app.use(koaBody())
// END Example

// Only routes starting by baseApi
app.use((ctx, next) => {
  console.log(`BEGIN\t${ctx.method} ${ctx.url}`, {
    path: ctx.path,
    baseApi: CONFIG_SESSION_RECOVERY.baseApi,
    test: ctx.path.startsWith(CONFIG_SESSION_RECOVERY.baseApi),
  })
  if (ctx.path.startsWith(CONFIG_SESSION_RECOVERY.baseApi)) {
    // It starts by our prefix, carry on.
    next()
  }
  console.log(`END\t${ctx.method} ${ctx.url}`)
})


app.use((ctx, next) => {
  let sessionState = { jwt: '' }
  if (ctx.state.sessionState) {
    sessionState = JSON.parse(JSON.stringify({ jwt: '', ...ctx.state.sessionState }))
  }
  if (
    ctx.path ===
    `${CONFIG_SESSION_RECOVERY.baseApi}${CONFIG_SESSION_RECOVERY.recoveryPath}`
  ) {
    if (ctx.method === 'POST') {
      if (AS_IF_WE_VALIDATED === ctx.request.body.jwt) {
        // This should come from a source of validation, and source of truth
        // Adding to the state the jwt, but we could also keep other preferences
        const sessionStateNew = { jwt: '', ...sessionState }
        sessionStateNew.jwt = ctx.request.body.jwt
        sessionState = sessionStateNew
      }
      // Persisting to the session (i.e. creating cookie) as per how koa-session is configured.
      ctx.session.sessionState = JSON.parse(JSON.stringify(sessionState))
      ctx.redirect(`${CONFIG_SESSION_RECOVERY.baseApi}/whois`)
      return
    }
  }
  // ------ END Things that would be in koa routes -----

  let newSessionState = JSON.parse(JSON.stringify(sessionState))

  // ------ BEGIN Sharing session state ------

  // 1. Either pick from cookie, thanks koa-session!
  let sessionStateMethod1 = null
  try {
    const maybe = JSON.parse(JSON.stringify(ctx.session.sessionState))
    sessionStateMethod1 = maybe
  } catch (e) {
    console.log('Sharing sessions state, method 1 ERROR', e)
  }

  // 1. Or do it yourself, manually
  let sessionStateMethod2 = null
  try {
    const cookieContentsString = ctx.cookies.get(CONFIG_HAS_SESSION.cookieName)
    const buff = Buffer.from(cookieContentsString, 'base64')
    const cookieContents = buff.toString('ascii')
    const maybe = JSON.parse(cookieContents)
    sessionStateMethod2 = maybe && maybe.sessionState ? maybe.sessionState : {}
  } catch (e) {
    console.log('Sharing sessions state, method 2 ERROR', e)
    // ...
  }

  // 2. Or use hasSessionCookie from hasSessionCookie middleware
  let sessionStateMethod3 = null
  try {
    const fromHasSessionCookieString = ctx.cookies.get(
      CONFIG_HAS_SESSION.cookieName,
    )
    const buff2 = Buffer.from(fromHasSessionCookieString, 'base64')
    const fromHasSessionCookieContents = buff2.toString('ascii')
    const maybe = JSON.parse(fromHasSessionCookieContents)
    sessionStateMethod3 = maybe && maybe.sessionState ? maybe.sessionState : {}
  } catch (e) {
    console.log('Sharing sessions state, method 3 ERROR', e)
    // ...
  }

  console.log(
    `END\t${ctx.method} ${ctx.url}\tController-ish Sharing session state methods`,
    {
      sessionStateMethod1,
      sessionStateMethod2,
      sessionStateMethod3,
    },
  )

  // Use one of the three methods
  const fallback = JSON.parse(JSON.stringify(newSessionState))
  newSessionState =
    sessionStateMethod1 ||
    sessionStateMethod2 ||
    sessionStateMethod3 ||
    fallback
  // sessionState = sessionStateMethod1
  // sessionState = sessionStateMethod2
  // sessionState = sessionStateMethod3

  // Ensure the ctx.state (koa internal state for cross-middleware state) is the same as ctx.session (cookie)
  ctx.state.sessionState = JSON.parse(JSON.stringify(newSessionState))

  // ------ END Sharing session state ------

  next()

  if (ctx.path === `${CONFIG_SESSION_RECOVERY.baseApi}/whois`) {
    ctx.body = ( ctx.state.sessionState || {} )
    // Nothing else to do, we stop here — no next!
    return
  }

  console.log(`END\t${ctx.method} ${ctx.url}\tController-ish`, {
    'ctx.request.body': JSON.parse(JSON.stringify(ctx.request.body)),
    hasSessionCookie: ( ctx.state.hasSessionCookie || null),
    sessionState,
    sessionState2,
    sessionState3,
  })
})

app.use(hasSessionCookieMiddleware(CONFIG_HAS_SESSION))
app.use(recoveryFormMiddleware(CONFIG_SESSION_RECOVERY))

app.listen(3000)
