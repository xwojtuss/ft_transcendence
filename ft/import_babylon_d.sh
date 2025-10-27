#!/bin/bash
if [[ ! -f "frontend/ts/gameUtils/babylon.d.ts" ]]; then
    curl https://preview.babylonjs.com/babylon.d.ts -o frontend/ts/gameUtils/babylon.d.ts
fi