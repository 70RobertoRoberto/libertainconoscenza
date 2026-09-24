// Generate + share a PDF certificate of completion.
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

type CertData = {
  user_name: string;
  title: string;
  category: string;
  completed_at: string;
  certificate_id: string;
};

export async function generateCertificate(c: CertData) {
  const date = new Date(c.completed_at).toLocaleDateString("it-IT", {
    day: "numeric", month: "long", year: "numeric",
  });
  const html = `
<!doctype html><html><head><meta charset="utf-8"/>
<style>
  @page { size: A4 landscape; margin: 0; }
  body {
    margin: 0; padding: 0; height: 100vh; width: 100vw;
    background: #0A0F0D; color: #F0F0EA;
    font-family: 'Times New Roman', serif;
    display: flex; align-items: center; justify-content: center;
  }
  .frame {
    width: 92%; height: 88%; padding: 40px;
    border: 2px solid #D4AF37;
    box-shadow: inset 0 0 0 8px #0A0F0D, inset 0 0 0 10px #D4AF37;
    display: flex; flex-direction: column; align-items: center; justify-content: space-between;
    text-align: center;
  }
  .brand { color: #D4AF37; font-size: 18px; letter-spacing: 6px; margin-top: 20px; }
  h1 { color: #F0F0EA; font-size: 52px; margin: 20px 0 8px; font-weight: 400; letter-spacing: 2px; }
  .sub { color: #C5C5B5; font-size: 20px; margin-bottom: 20px; }
  .name { color: #D4AF37; font-size: 44px; font-style: italic; margin: 16px 0; border-bottom: 1px solid #3A4740; padding: 0 40px 12px; }
  .body { color: #E0E0D5; font-size: 20px; line-height: 1.6; max-width: 620px; margin: 0 auto; }
  .title { color: #F0F0EA; font-size: 26px; font-weight: 600; margin: 12px 0; }
  .cat { color: #B38B4D; font-size: 14px; letter-spacing: 3px; text-transform: uppercase; }
  .footer { display: flex; justify-content: space-between; width: 100%; padding: 0 20px; margin-top: 30px; }
  .foot-item { flex: 1; text-align: center; }
  .foot-lbl { color: #88948E; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; }
  .foot-val { color: #D4AF37; font-size: 16px; margin-top: 4px; }
  .id { color: #88948E; font-size: 10px; margin-top: 6px; }
</style>
</head><body>
  <div class="frame">
    <div>
      <div class="brand">CONOSCENZA APERTA</div>
      <h1>Attestato</h1>
      <div class="sub">di Completamento</div>
      <div class="body">Si certifica che</div>
      <div class="name">${escapeHtml(c.user_name)}</div>
      <div class="body">ha completato con dedizione il percorso</div>
      <div class="title">"${escapeHtml(c.title)}"</div>
      <div class="cat">${escapeHtml(c.category)}</div>
    </div>
    <div class="footer">
      <div class="foot-item">
        <div class="foot-lbl">Data</div>
        <div class="foot-val">${date}</div>
      </div>
      <div class="foot-item">
        <div class="foot-lbl">Firma</div>
        <div class="foot-val" style="font-style:italic;">Libertà in Conoscenza</div>
      </div>
      <div class="foot-item">
        <div class="foot-lbl">ID</div>
        <div class="id">${c.certificate_id.slice(0, 8).toUpperCase()}</div>
      </div>
    </div>
  </div>
</body></html>`;
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (Platform.OS === "web") {
    // Open in a new tab for download
    if (typeof window !== "undefined") window.open(uri, "_blank");
    return uri;
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: ".pdf" });
  }
  return uri;
}

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (ch) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[ch];
  });
}
