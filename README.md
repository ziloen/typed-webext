# typed-webext
 Type safe web extension api (partial)


> [!WARNING]
> Still working in progress, do not use in production

## Message 

Based on `browser.runtime.sendMessage`

To Start using this, you need to extend the `MessageProtocol` interface

```ts
import { MessageProtocol } from 'typed-webext'

declare module "typed-webext" {
  interface MessageProtocol<T = unknown> {
    "get-time": [never, number]
  }
}
```

### `sendMessage`

```ts
sendMessage("get-time")
  .then((time) => {
    console.log(time)
    //          ^ time: number
  })
  .catch(error => {
    console.error(error)
  })
```

### `onMessage`

```ts
// background.ts

onMessage("get-time", () => {
  const now = new Date()
  if (now.getFullYear() > 1999) {
    throw new Error("You are late!")
  } else {
    return +now
  }
})
```

## Stream 

Based on `browser.runtime.connect`

```ts
import { StreamProtocol } from 'typed-webext'

declare module "typed-webext" {
  interface StreamProtocol {
    chat: [
      // Stream sender data type
      { text: string, model: "gpt-4" },
      // Stream reciver return data type
      { text: string } | { error: ErrorObject } | { done: true }
    ]
   }
}
```

### `openStream` 

```ts
import { deserializeError } from 'serialize-error'

const stream = openStream("chat")

// 1. use async iterator
for await (data of stream.iter({ text: "Hi", model: "gpt-4" })) {
  if (Object.hasOwn(data, "text")) {
    console.log(data.text)
  } else if (Object.hasOwn(data, "error")) {
    console.error(deserializeError(data.error))
  }
}

// 2. use onMessage callback
stream.send({ text: "Hi", model: "gpt-4" })

stream.onMessage((data) => {
  if (Object.hasOwn(data, "text")) {
    console.log(data.text)
  } else if (Object.hasOwn(data, "error")) {
    console.error(deserializeError(data.error))
  }
})
```

### `onOpenStream`

```ts
import { serializeError } from 'serialize-error'

onOpenStream("chat", (stream) => {
  stream.onMessage(data => {
    chatApi(data, { 
      signal: stream.signal,
      onStramn(data) {
        stream.send({ data })
      }
    })
      .then(() => {
        stream.send({ done: true })
        stream.close()
      })
      .catch(error => {
        if (error.name === "AbortError") {
          return
        }
        stream.send({ error: serializeError(error) })
      })
  })
})
```

## Storage Local 

Based on `browser.storage.local`

```ts
import { StorageLocalProtocol } from 'typed-webext'

declare module "typed-webext" {
  interface StorageLocalProtocol {
    theme: "light" | "dark" | "high-contrast" | "auto"
  }
}
```

### `getStorageLocal` 

```ts
async function getTheme() {
  const theme = await getStorageLocal("theme", "auto")
  //    ^ "light" | "dark" | "high-contrast" | "auto"
}
```

### `setStorageLocal`

```ts
async function setTheme(theme: "light" | "dark" | "high-contrast" | "auto") {
  // Key, Value
  await setStorageLocal("theme", theme)
  // Or Key-value pair
  // await setStroageLocal({ theme })
}
```