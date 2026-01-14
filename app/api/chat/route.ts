import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime"
import { NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import path from "node:path"

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
const DEFAULT_TEMPERATURE = 0.4

type ChatMessage = { role: string; content: string }

function stripAsterisks(text: string) {
  return text.replace(/\*/g, "")
}

function getProvider() {
  const explicit = process.env.CHAT_PROVIDER?.trim().toLowerCase()
  if (explicit) return explicit
  if (process.env.BEDROCK_MODEL_ID) return "bedrock"
  return "groq"
}

function toBedrockMessages(messages: ChatMessage[], systemPrompt: string) {
  const system: Array<{ text: string }> = []
  const normalizedMessages: Array<{ role: "user" | "assistant"; content: Array<{ text: string }> }> = []

  if (systemPrompt.trim()) {
    system.push({ text: systemPrompt })
  }

  for (const message of messages) {
    if (message.role === "system") {
      const trimmed = message.content.trim()
      if (trimmed) system.push({ text: trimmed })
      continue
    }
    if (message.role !== "user" && message.role !== "assistant") {
      throw new Error(`Unsupported role: ${message.role}`)
    }
    normalizedMessages.push({ role: message.role, content: [{ text: message.content }] })
  }

  return { messages: normalizedMessages, system }
}

let cachedSystemPrompt: string | null = null

async function getSystemPrompt() {
  if (cachedSystemPrompt !== null) return cachedSystemPrompt
  const envPrompt = process.env.GROQ_SYSTEM_PROMPT
  if (envPrompt && envPrompt.trim()) {
    cachedSystemPrompt = envPrompt.trim()
    return cachedSystemPrompt
  }
  try {
    const file = await readFile(path.join(process.cwd(), "SYSTEM_PROMPT.md"), "utf8")
    cachedSystemPrompt = file.trim()
    return cachedSystemPrompt
  } catch {
    cachedSystemPrompt = ""
    return cachedSystemPrompt
  }
}

export async function POST(request: Request) {
  const provider = getProvider()
  const apiKey = process.env.GROQ_API_KEY
  const model = process.env.GROQ_MODEL
  const bedrockModelId = process.env.BEDROCK_MODEL_ID
  const bedrockRegion = process.env.BEDROCK_REGION || process.env.AWS_REGION

  let body: { messages?: ChatMessage[] } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  if (!Array.isArray(body.messages)) {
    return NextResponse.json({ error: "Missing messages array." }, { status: 400 })
  }

  const systemPrompt = await getSystemPrompt()

  for (const message of body.messages) {
    if (!message || typeof message.role !== "string" || typeof message.content !== "string") {
      return NextResponse.json({ error: "Invalid message format." }, { status: 400 })
    }
  }

  if (provider === "bedrock") {
    if (!bedrockModelId || !bedrockRegion) {
      return NextResponse.json(
        { error: "Missing BEDROCK_MODEL_ID or BEDROCK_REGION (or AWS_REGION) in environment." },
        { status: 500 },
      )
    }

    let bedrockMessages: ReturnType<typeof toBedrockMessages>
    try {
      bedrockMessages = toBedrockMessages(body.messages, systemPrompt)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unsupported message role." },
        { status: 400 },
      )
    }

    if (!bedrockMessages.messages.length) {
      return NextResponse.json({ error: "Missing user or assistant messages." }, { status: 400 })
    }

    const client = new BedrockRuntimeClient({ region: bedrockRegion })
    const command = new ConverseCommand({
      modelId: bedrockModelId,
      messages: bedrockMessages.messages,
      system: bedrockMessages.system.length ? bedrockMessages.system : undefined,
      inferenceConfig: { temperature: DEFAULT_TEMPERATURE },
    })

    let response
    try {
      response = await client.send(command)
    } catch (error) {
      return NextResponse.json(
        { error: "Bedrock request failed.", details: error instanceof Error ? error.message : "" },
        { status: 502 },
      )
    }

    const contentBlocks = response.output?.message?.content ?? []
    const content = contentBlocks
      .map((block) => ("text" in block ? block.text ?? "" : ""))
      .join("")

    return NextResponse.json({ content: stripAsterisks(content) })
  }

  if (!apiKey || !model) {
    return NextResponse.json(
      { error: "Missing GROQ_API_KEY or GROQ_MODEL in environment." },
      { status: 500 },
    )
  }

  const messages = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...body.messages]
    : body.messages

  const groqResponse = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: DEFAULT_TEMPERATURE,
    }),
  })

  if (!groqResponse.ok) {
    const details = await groqResponse.text()
    return NextResponse.json(
      { error: "Groq request failed.", details },
      { status: groqResponse.status },
    )
  }

  const data = await groqResponse.json()
  const content = data?.choices?.[0]?.message?.content ?? ""

  return NextResponse.json({ content: stripAsterisks(content) })
}

export const runtime = "nodejs"
