/**
 * RichEditor — WEB implementation (Metro picks this file on web platform).
 *
 * Uses a real HTML <iframe> (via react-native-web's unstable_createElement)
 * because react-native-webview is native-only. Same public API as the .tsx
 * (native) version: <RichEditor visible ...> and <RichViewer html={...} />.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Text,
} from "react-native";
// @ts-expect-error — react-native-web unstable export not typed
import { unstable_createElement } from "react-native-web";
import { colors, spacing, radius } from "@/src/theme";

const Iframe: any = React.forwardRef(function Iframe(props: any, ref: any) {
  return unstable_createElement("iframe", { ...props, ref });
});

export function RichEditor({
  visible,
  initialHtml,
  onSave,
  onClose,
  title = "Editor",
}: {
  visible: boolean;
  initialHtml: string;
  onSave: (html: string) => void;
  onClose: () => void;
  title?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);

  const html = useMemo(() => buildEditorHtml(initialHtml), [initialHtml]);

  // Reset ready when the modal opens/closes so we re-init on every open.
  useEffect(() => {
    if (!visible) setReady(false);
  }, [visible]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (typeof e.data !== "string") return;
      try {
        const msg = JSON.parse(e.data);
        if (msg && msg.__editor === true) {
          if (msg.type === "ready") setReady(true);
          if (msg.type === "save") onSave(msg.html || "");
        }
      } catch {}
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onSave]);

  const requestSave = () => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ __host: true, type: "save" }),
      "*",
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={styles.headerBtn}>Annulla</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <Pressable onPress={requestSave} hitSlop={10} disabled={!ready}>
          <Text style={[styles.headerBtn, { fontWeight: "800" }]}>Salva</Text>
        </Pressable>
      </View>
      {!ready ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.brandPrimary} />
          <Text style={{ color: colors.muted, marginTop: 8 }}>Caricamento editor…</Text>
        </View>
      ) : null}
      <Iframe
        ref={iframeRef}
        srcDoc={html}
        style={{
          flex: 1,
          border: "none",
          width: "100%",
          height: "100%",
          opacity: ready ? 1 : 0,
          background: colors.surface,
        }}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      />
    </Modal>
  );
}

/**
 * Read-only viewer for course HTML on web — just an iframe with sanitized content.
 */
export function RichViewer({ html }: { html: string }) {
  const doc = useMemo(() => buildViewerHtml(html), [html]);
  return (
    <View style={styles.viewer}>
      <Iframe
        srcDoc={doc}
        style={{ border: "none", width: "100%", height: "100%", background: "transparent" }}
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </View>
  );
}

function buildEditorHtml(initial: string): string {
  const safeInitial = (initial || "").replace(/<\/script>/gi, "<\\/script>");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="https://cdn.jsdelivr.net/npm/tinymce@6/tinymce.min.js" referrerpolicy="origin"></script>
<style>
  html, body { margin:0; padding:0; height:100%; background:#fff; }
  .tox-tinymce { border:none !important; }
</style>
</head>
<body>
<textarea id="editor"></textarea>
<script>
  const post = (m) => window.parent.postMessage(JSON.stringify(Object.assign({__editor:true}, m)), '*');
  window.addEventListener('message', function(e){
    try {
      const msg = JSON.parse(e.data || '{}');
      if (msg && msg.__host && msg.type === 'save' && window.tinymce && tinymce.activeEditor) {
        post({ type: 'save', html: tinymce.activeEditor.getContent() });
      }
    } catch(_) {}
  });
  document.addEventListener('DOMContentLoaded', function() {
    tinymce.init({
      selector: '#editor',
      height: window.innerHeight - 4,
      menubar: false,
      branding: false,
      elementpath: false,
      plugins: 'lists link image autolink paste media table code',
      toolbar:
        'undo redo | styleselect | fontsize | bold italic underline forecolor | ' +
        'alignleft aligncenter alignright alignjustify | ' +
        'bullist numlist | link image youtube | removeformat',
      toolbar_mode: 'sliding',
      paste_data_images: true,
      paste_as_text: false,
      relative_urls: false,
      convert_urls: false,
      content_style:
        'body { font-family: -apple-system, Roboto, sans-serif; font-size: 15px; line-height: 1.55; color:#1a1a1a; padding: 12px; }' +
        ' img { max-width: 100%; height: auto; }' +
        ' iframe { max-width: 100%; }',
      images_upload_handler: function(blobInfo) {
        return new Promise(function(resolve, reject) {
          const blob = blobInfo.blob();
          if (blob.size > 1048576) { alert('Immagine troppo grande. Max 1 MB.'); reject('image too large'); return; }
          const reader = new FileReader();
          reader.onload = function() { resolve(reader.result); };
          reader.onerror = function() { reject('read error'); };
          reader.readAsDataURL(blob);
        });
      },
      setup: function(ed) {
        ed.ui.registry.addButton('youtube', {
          icon: 'embed',
          tooltip: 'Inserisci video YouTube',
          onAction: function() {
            const url = prompt('Incolla URL YouTube:');
            if (!url) return;
            const m = url.match(/(?:v=|\\/embed\\/|youtu\\.be\\/)([\\w-]{6,})/);
            const id = m ? m[1] : null;
            if (!id) { alert('URL non valido'); return; }
            const iframe = '<p><iframe width="100%" height="220" src="https://www.youtube.com/embed/' + id + '" frameborder="0" allowfullscreen></iframe></p>';
            ed.insertContent(iframe);
          }
        });
        ed.on('init', function() {
          ed.setContent(${JSON.stringify(safeInitial)});
          post({ type: 'ready' });
        });
      }
    });
  });
</script>
</body>
</html>`;
}

function buildViewerHtml(html: string): string {
  const body = html || "<p><em>Nessun contenuto.</em></p>";
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
<style>
  html, body { margin:0; padding:0; background:${colors.surface}; color:${colors.onSurface}; }
  body { font-family: -apple-system, Roboto, sans-serif; font-size: 15px; line-height: 1.6; padding: 12px; }
  img, iframe { max-width: 100%; height: auto; border-radius: 8px; }
  iframe { width: 100%; min-height: 200px; }
  a { color: ${colors.brandPrimary}; }
  ul, ol { padding-left: 22px; }
</style>
</head>
<body>${body}</body>
</html>`;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "700" },
  headerBtn: { color: colors.brandPrimary, fontSize: 15 },
  loader: {
    position: "absolute",
    top: 120,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  viewer: {
    flex: 1,
    minHeight: 200,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: "hidden",
  },
});
