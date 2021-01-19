#!/usr/bin/env node

import { bearerToken } from '../bearerToken.mjs'

const parts = bearerToken(process.argv[2])
console.log('Decode Bearer Token\n', parts)
