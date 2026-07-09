const CF_API = 'https://api.cloudflare.com/client/v4'

function getConfig() {
  const accountId = process.env.CF_ACCOUNT_ID
  const apiToken = process.env.CF_EMAIL_API_TOKEN
  const from = process.env.EMAIL_FROM ?? 'noreply@contrivent.com'

  if (!accountId || !apiToken) {
    throw new Error('CF_ACCOUNT_ID and CF_EMAIL_API_TOKEN required for email sending')
  }

  return { accountId, apiToken, from }
}

interface SendEmailInput {
  to: string
  subject: string
  html: string
  text: string
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const { accountId, apiToken, from } = getConfig()

  const res = await fetch(`${CF_API}/accounts/${accountId}/email/sending/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: { name: 'Pinote', email: from },
      to: [{ email: input.to }],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error(`Email send failed (${res.status}): ${text}`)
  }
}

export async function sendTaskNotification(input: {
  to: string
  taskTitle: string
  meetingTitle?: string
  assigneeName?: string
}): Promise<void> {
  const subject = `Tugas Baru: ${input.taskTitle}`
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="background: linear-gradient(140deg, #1E1B4B, #312E81); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 28px; font-family: serif; font-style: italic; color: #fff;">π</span>
        <span style="font-size: 18px; font-weight: 600; color: #fff; margin-left: 8px;">Pinote</span>
      </div>
      <h2 style="font-size: 18px; margin: 0 0 8px;">Halo ${input.assigneeName || 'Sobat Pinote'}</h2>
      <p style="color: #64748B; margin: 0 0 16px; line-height: 1.6;">Ada tugas baru yang menunggu kamu:</p>
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <p style="margin: 0; font-weight: 600; font-size: 15px;">${input.taskTitle}</p>
        ${input.meetingTitle ? `<p style="margin: 8px 0 0; color: #64748B; font-size: 13px;">Dari rapat: ${input.meetingTitle}</p>` : ''}
      </div>
      <p style="color: #94A3B8; font-size: 12px; margin: 0;">Buka dashboard Pinote buat detailnya.</p>
    </div>
  `
  const text = `Halo ${input.assigneeName || 'Sobat Pinote'},\n\nAda tugas baru: ${input.taskTitle}${input.meetingTitle ? `\nDari rapat: ${input.meetingTitle}` : ''}\n\nBuka dashboard Pinote buat detailnya.`

  await sendEmail({ to: input.to, subject, html, text })
}
