// ไฟล์: functions/api/image.ts
const ALLOWED_PREFIXES = [
  "food/", "leaves/", "plastic/", "paper/", "glass/", "can/", "general/", "hazardous/",
];

export const onRequestGet = async (context: { request: Request; env: { BUCKET: any } }) => {
  const url = new URL(context.request.url);
  const key = url.searchParams.get("key") || "";

  // ตรวจสอบว่าต้องอยู่ในโฟลเดอร์หมวดหมู่ขยะทั้ง 8 เท่านั้น และห้ามมี ..
  const isValidKey =
    !key.includes("..") && ALLOWED_PREFIXES.some((prefix) => key.startsWith(prefix));

  if (!isValidKey || !context.env.BUCKET) {
    return new Response("Not Found", { status: 404 });
  }

  const object = await context.env.BUCKET.get(key);
  if (!object) return new Response("Image Not Found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
};