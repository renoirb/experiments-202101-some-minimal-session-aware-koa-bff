import Koa from 'koa'
import koaBody from 'koa-body'
import session from 'koa-session'
import koaHttProxy from 'koa-better-http-proxy'
import URL from 'url'
import {
  hasSessionCookieMiddleware,
  recoveryFormMiddleware,
} from '@renoirb/koa-middleware-utils'

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

const {
  // BEGIN Node.js/npm managed environment varibles from package.json
  npm_package_name = 'bff',
  // END Node.js/npm managed environment varibles from package.json
  // BEGIN environment variables we can set prior to running
  // set to anything else to avoid console.log
  APP_CONSOLE_LOG = false,
  APP_CONSOLE_LOG_ERROR = false,
  APP_SESSION_SECRET_KEYS = 'replace,me,please',
  APP_DATA_SOURCE_ORIGIN_PROXY = null,
  // END environment variables we can set prior to running
} = process.env || {}

/**
 * Really, we should check a bit more about the string
 * what it contains.
 * This isn't going to check if it is valid.
 * For this we'd need the Session State middleware to do more.
 */
const isValid = (input) => typeof input === 'string'

// tip: koa-bunyan, koa-bunyan-logger, koa-logger
const log = (...args) =>
  APP_CONSOLE_LOG !== false
    ? console.log.apply(null, [npm_package_name, ...args])
    : void 0

const logError = (...args) =>
  APP_CONSOLE_LOG_ERROR === false
    ? console.log.apply(null, [`${npm_package_name} ERROR`, ...args])
    : void 0

// BEGIN Example
// https://github.com/koajs/session#example
const app = new Koa()
app.keys = (APP_SESSION_SECRET_KEYS || '').split(',')
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
// https://github.com/nsimmons/koa-better-http-proxy
const proxyAlphaUrl = `${CONFIG_SESSION_RECOVERY.baseApi}/proxy`
if (APP_DATA_SOURCE_ORIGIN_PROXY) {
  app.use(
    koaHttProxy(APP_DATA_SOURCE_ORIGIN_PROXY, {
      timeout: 2000,
      strippedHeaders: ['set-cookie', 'location', 'cookie', 'referer'],
      proxyReqPathResolver(ctx) {
        const urlObj = URL.parse(APP_DATA_SOURCE_ORIGIN_PROXY)
        const { path = '/' } = urlObj
        return path
      },
      filter(ctx) {
        // Contrived example of only one, normally we would have more thn one
        const proxyAlpha = ctx.path.startsWith(proxyAlphaUrl)
        let proxy = proxyAlpha !== false
        log('koaHttpProxy filter', {
          proxyAlphaUrl,
          proxyAlpha,
          shouldProxy: proxy,
        })
        ctx.state.proxy = proxy
        return proxy
      },
      // https://www.npmjs.com/package/koa-better-http-proxy#proxyreqoptdecorator--supports-promise-form
      proxyReqOptDecorator(proxyReqOpts, ctx) {
        const authorizationToken =
          ctx.session &&
          ctx.session.sessionState &&
          ctx.session.sessionState.authorizationToken
        ctx.assert(
          typeof authorizationToken === 'string' && authorizationToken !== '',
          401,
        )
        if (authorizationToken) {
          proxyReqOpts.headers['Authorization'] = `Bearer ${authorizationToken}`
        }
        if ('cookie' in proxyReqOpts.headers) {
          delete proxyReqOpts.headers.cookie
        }
        if ('referer' in proxyReqOpts.headers) {
          delete proxyReqOpts.headers.referer
        }
        return proxyReqOpts
      },
    }),
  )
  console.log(`Will Proxy ${proxyAlphaUrl} => ${APP_DATA_SOURCE_ORIGIN_PROXY}`)
} else {
  console.log(`Will NOT Proxy ${proxyAlphaUrl}`)
}

// Only routes starting by baseApi
app.use((ctx, next) => {
  log(`BEGIN\t${ctx.method} ${ctx.url}`, {
    path: ctx.path,
    baseApi: CONFIG_SESSION_RECOVERY.baseApi,
    test: ctx.path.startsWith(CONFIG_SESSION_RECOVERY.baseApi),
  })
  if (ctx.path.startsWith(CONFIG_SESSION_RECOVERY.baseApi)) {
    // It starts by our prefix, carry on.
    next()
  }
  log(`END\t${ctx.method} ${ctx.url}`)
})

// Session State middlewre
app.use((ctx, next) => {
  let sessionState = { authorizationToken: '' }
  if (ctx.state.sessionState) {
    sessionState = JSON.parse(
      JSON.stringify({ authorizationToken: '', ...ctx.state.sessionState }),
    )
  }

  if (
    ctx.path ===
    `${CONFIG_SESSION_RECOVERY.baseApi}${CONFIG_SESSION_RECOVERY.recoveryPath}`
  ) {
    if (ctx.method === 'POST') {
      const { jwt = null } = ctx.request.body
      if (isValid(jwt)) {
        // This should come from a source of validation, and source of truth
        // Adding to the state the authoriztionToken, but we could also keep other preferences
        const sessionStateNew = { authorizationToken: '', ...sessionState }
        sessionStateNew.authorizationToken = jwt
        sessionState = sessionStateNew
      }
      // Persisting to the session (i.e. creating cookie) as per how koa-session is configured.
      ctx.session.sessionState = JSON.parse(JSON.stringify(sessionState))
      ctx.redirect(`${CONFIG_SESSION_RECOVERY.baseApi}/whois`)
      return
    }
  }

  // ------ BEGIN Sharing session state ------
  // But, really, there has to be a simpler way. TODO
  let newSessionState = JSON.parse(JSON.stringify(sessionState))
  // 1. Either pick from cookie, thanks koa-session!
  let sessionStateMethod1 = null
  try {
    const maybe = JSON.parse(JSON.stringify(ctx.session.sessionState))
    sessionStateMethod1 = maybe
  } catch (e) {
    logError('Sharing sessions state, method 1 failed', e)
  }
  // 2. Or do it yourself, manually
  let sessionStateMethod2 = null
  try {
    const cookieContentsString = ctx.cookies.get(CONFIG_HAS_SESSION.cookieName)
    const buff = Buffer.from(cookieContentsString || '', 'base64')
    const cookieContents = buff.toString('ascii')
    const maybe = JSON.parse(cookieContents)
    sessionStateMethod2 = maybe && maybe.sessionState ? maybe.sessionState : {}
  } catch (e) {
    logError('Sharing sessions state, method 2 failed', e)
  }
  // 3. Or use hasSessionCookie from hasSessionCookie middleware
  let sessionStateMethod3 = null
  try {
    const fromHasSessionCookieString = ctx.cookies.get(
      CONFIG_HAS_SESSION.cookieName,
    )
    const buff2 = Buffer.from(fromHasSessionCookieString || '', 'base64')
    const fromHasSessionCookieContents = buff2.toString('ascii')
    const maybe = JSON.parse(fromHasSessionCookieContents)
    sessionStateMethod3 = maybe && maybe.sessionState ? maybe.sessionState : {}
  } catch (e) {
    logError('Sharing sessions state, method 3 failed', e)
  }
  log(
    `END\t${ctx.method} ${ctx.url}\tController-ish Sharing session state methods`,
    // {
    //   sessionStateMethod1,
    //   sessionStateMethod2,
    //   sessionStateMethod3,
    // },
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
    let body = {}
    try {
      // Really, we should not leak jwt at all.
      // This is just for show.
      // Ideally, we should provide a consistent current user state
      // with things such as locale, timezone, default user data fullName, etc.
      const maybe = JSON.parse(JSON.stringify(ctx.state.sessionState || {}))
      body = {
        __comment__:
          'This is just for show. Normally authorizationToken should be communicated exclusively via HTTPOnly cookies',
        ...maybe,
      }
    } catch (e) {
      logError(e)
    }
    ctx.body = body
  }

  // log(`END\t${ctx.method} ${ctx.url}\tController-ish`, {
  //   'ctx.request.body': JSON.parse(JSON.stringify(ctx.request.body)),
  //   hasSessionCookie: ctx.state.hasSessionCookie || null,
  //   sessionState: newSessionState,
  // })
})

app.use(hasSessionCookieMiddleware(CONFIG_HAS_SESSION))
app.use(recoveryFormMiddleware(CONFIG_SESSION_RECOVERY))

app.listen(3000)
