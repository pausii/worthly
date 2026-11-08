/**
 * Ambil teks hasil dari Workers AI. Model lama mengembalikan `{ response: string }`, sedangkan
 * model yang mengikuti format OpenAI (mis. GLM, Qwen) mengembalikan `choices[0].message.content`.
 * Menerima keduanya agar mengganti model lewat variabel INSIGHT_MODEL tidak perlu ubah kode.
 */
export function extractAiText(result: unknown): string {
  if (typeof result === 'string') return result.trim();
  const r = result as { response?: unknown; choices?: Array<{ message?: { content?: unknown } }> } | null | undefined;
  if (typeof r?.response === 'string') return r.response.trim();
  const content = r?.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content.trim() : '';
}
