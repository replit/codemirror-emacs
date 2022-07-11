#!/usr/bin/env node

import { build } from '@marijn/buildtool'
import * as path from 'path'

build(path.resolve('src/index.ts'), { pureTopCalls: false }).then(result => {
    if (!result) process.exit(1)
})
