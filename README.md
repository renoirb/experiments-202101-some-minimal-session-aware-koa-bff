[repo]:
  https://github.com/renoirb/experiments-202101-some-minimal-session-aware-koa-bff/branches

# [Experiments **2020-01**; Some minimal session aware Backend For Frontned using Koa][repo]

In order to allow a stateless web app that gives more context to a
micro-frontend, we need an HTTP servie that can tell us if we're authenticated
and if we are, allow us to read data to other internal APIs.

For security, we don't want to expose directly those internal APIs, we're
proxing them ONLY if the _authentication proof_ (e.g. some token) is passed
along an authoritative source.

For this, we can make this BFF store for us this _authentication proof_ as an
HTTPOnly cookie that this BFF can re-use, so that client-side JavaScript never
sees it.
