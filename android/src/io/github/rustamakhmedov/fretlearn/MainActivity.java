package io.github.rustamakhmedov.fretlearn;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import android.window.OnBackInvokedDispatcher;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Map;

// fretlearn als echte App: die Website liegt in assets/www und wird unter einer festen
// https-Adresse ausgeliefert. Fortschritt landet zusätzlich als Datei im App-Speicher.
public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String START = "https://" + HOST + "/index.html";
    static final int REQ_OPEN = 1, REQ_BACKUP = 2;

    static final Map<String, String> MIME = new HashMap<>();
    static {
        MIME.put("html", "text/html"); MIME.put("js", "text/javascript"); MIME.put("mjs", "text/javascript");
        MIME.put("css", "text/css"); MIME.put("svg", "image/svg+xml"); MIME.put("png", "image/png");
        MIME.put("json", "application/json"); MIME.put("webmanifest", "application/manifest+json");
    }

    WebView web;
    ValueCallback<Uri[]> pendingOpen;
    String pendingBackup;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xff141114);
        web = new WebView(this);
        web.setBackgroundColor(0xff141114);
        root.addView(web);
        setContentView(root);

        // ab Android 15 liegt die App unter Status- und Navigationsleiste: oben/unten regelt das CSS
        // (env(safe-area-inset-*)), seitlich (quer, Kamera-Aussparung) rücken wir selbst ein
        if (Build.VERSION.SDK_INT >= 35) {
            root.setOnApplyWindowInsetsListener((v, in) -> {
                Insets i = in.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                v.setPadding(i.left, 0, i.right, 0);
                return in;
            });
        }

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);
        web.addJavascriptInterface(new Bridge(), "FretlearnApp");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (pendingOpen != null) pendingOpen.onReceiveValue(null);
                pendingOpen = cb;
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                try { startActivityForResult(i, REQ_OPEN); } catch (Exception e) { pendingOpen = null; return false; }
                return true;
            }
        });

        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::back);
        }
        if (saved == null || web.restoreState(saved) == null) web.loadUrl(START);
    }

    // Zurück: erst offenes Fenster schließen, dann in der App zurück, sonst raus
    void back() {
        web.evaluateJavascript("window.fretlearnBack ? fretlearnBack() : false", r -> {
            if ("true".equals(r)) return;
            if (web.canGoBack()) web.goBack(); else finish();
        });
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() { back(); }

    @Override
    protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
    @Override
    protected void onPause() { super.onPause(); web.onPause(); }
    @Override
    protected void onResume() { super.onResume(); web.onResume(); }
    @Override
    protected void onDestroy() { web.destroy(); super.onDestroy(); }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ_OPEN && pendingOpen != null) {
            Uri u = res == RESULT_OK && data != null ? data.getData() : null;
            pendingOpen.onReceiveValue(u != null ? new Uri[]{u} : null);
            pendingOpen = null;
        } else if (req == REQ_BACKUP && pendingBackup != null) {
            String json = pendingBackup;
            pendingBackup = null;
            if (res != RESULT_OK || data == null || data.getData() == null) return;
            try (OutputStream o = getContentResolver().openOutputStream(data.getData(), "wt")) {
                o.write(json.getBytes(StandardCharsets.UTF_8));
                toast("Backup gespeichert");
            } catch (Exception e) {
                toast("Backup konnte nicht gespeichert werden");
            }
        }
    }

    void toast(String t) { Toast.makeText(this, t, Toast.LENGTH_SHORT).show(); }

    class Client extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
            Uri u = r.getUrl();
            if (!HOST.equals(u.getHost())) return null;
            String path = u.getPath();
            if (path == null || path.equals("/")) path = "/index.html";
            if (path.contains("..")) return notFound();
            String ext = path.substring(path.lastIndexOf('.') + 1);
            try {
                InputStream in = getAssets().open("www" + path);
                WebResourceResponse resp = new WebResourceResponse(MIME.getOrDefault(ext, "application/octet-stream"), "utf-8", in);
                Map<String, String> h = new HashMap<>();
                h.put("Cache-Control", "no-cache");
                resp.setResponseHeaders(h);
                return resp;
            } catch (IOException e) {
                return notFound();
            }
        }

        WebResourceResponse notFound() {
            WebResourceResponse r = new WebResourceResponse("text/plain", "utf-8", null);
            r.setStatusCodeAndReasonPhrase(404, "Not Found");
            return r;
        }

        // fremde Links im normalen Browser öffnen
        @Override
        public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
            if (HOST.equals(r.getUrl().getHost())) return false;
            try { startActivity(new Intent(Intent.ACTION_VIEW, r.getUrl())); } catch (Exception ignored) { }
            return true;
        }
    }

    // Wird von js/store.js benutzt (window.FretlearnApp). Läuft nicht im UI-Thread.
    class Bridge {
        final File file = new File(getFilesDir(), "progress.json");

        @JavascriptInterface
        public String load() {
            try { return file.exists() ? new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8) : null; }
            catch (IOException e) { return null; }
        }

        // erst in Hilfsdatei schreiben, dann umbenennen → nie eine halb geschriebene Datei
        @JavascriptInterface
        public synchronized boolean save(String json) {
            File tmp = new File(getFilesDir(), "progress.json.tmp");
            try (FileOutputStream o = new FileOutputStream(tmp)) {
                o.write(json.getBytes(StandardCharsets.UTF_8));
                o.getFD().sync();
            } catch (IOException e) {
                return false;
            }
            return tmp.renameTo(file);
        }

        @JavascriptInterface
        public void saveBackup(String json, String name) {
            runOnUiThread(() -> {
                pendingBackup = json;
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                        .setType("application/json").putExtra(Intent.EXTRA_TITLE, name);
                try { startActivityForResult(i, REQ_BACKUP); }
                catch (Exception e) { pendingBackup = null; toast("Kein Dateimanager gefunden"); }
            });
        }
    }
}
