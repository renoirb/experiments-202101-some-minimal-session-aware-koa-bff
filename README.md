[repo]:
  https://github.com/renoirb/experiments-202101-some-minimal-session-aware-koa-bff/branches

# [Experiments **2021-01**; Some minimal session aware Backend For Frontned using Koa][repo]

In order to allow a stateless web app that gives more context to a
micro-frontend, we need an HTTP servie that can tell us if we're authenticated
and if we are, allow us to read data to other internal APIs.

For security, we don't want to expose directly those internal APIs, we're
proxing them ONLY if the _authentication proof_ (e.g. some token) is passed
along an authoritative source.

For this, we can make this BFF store for us this _authentication proof_ as an
HTTPOnly cookie that this BFF can re-use, so that client-side JavaScript never
sees it.

## Usage example

Before starint the service, setup options

```
export APP_CONSOLE_LOG=please
export APP_DATA_SOURCE_ORIGIN_PROXY="https://foo.bar.some.origin.example.org/some/path"
yarn start
```

Then, in a web browser, we'll have to tell which `Authoriztion: Bearer ...` to
use, we can tell it by using the _recovery_ route

- Look the current autorization token `http://localhost:3000/bff/whois`
- Change the authorization token `http://localhost:3000/bff/recovery`
- Make the request to the proxyed service `http://localhost:3000/bff/proxy`
