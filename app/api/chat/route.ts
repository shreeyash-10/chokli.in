import { NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import path from "node:path"

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"

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
  const apiKey = process.env.GROQ_API_KEY
  const model = process.env.GROQ_MODEL

  if (!apiKey || !model) {
    return NextResponse.json(
      { error: "Missing GROQ_API_KEY or GROQ_MODEL in environment." },
      { status: 500 },
    )
  }

  let body: { messages?: Array<{ role: string; content: string }> } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  if (!Array.isArray(body.messages)) {
    return NextResponse.json({ error: "Missing messages array." }, { status: 400 })
  }

  const systemPrompt = await getSystemPrompt()
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
      temperature: 0.4,
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

  return NextResponse.json({ content })
}

export const runtime = "nodejs"
