package com.tavlatv.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleAppLink(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleAppLink(intent);
    }

    // Android App-Link ile açılan Google OAuth DÖNÜŞ URL'ini (www.tavlatv.com/auth/google/app-return?code=…)
    // WebView'a DOĞRUDAN yükle. Bu remote-load (server.url) kurulumunda Capacitor native köprüsü sayfaya
    // enjekte olmadığından (bkz WebViewLocalServer proxy-enjeksiyonu başarısız) appUrlOpen olayı JS'e
    // ulaşmaz; bu yüzden URL'i native tarafta WebView'a biz yüklüyoruz -> React App.tsx code'u yakalar.
    private void handleAppLink(Intent intent) {
        if (intent == null) {
            return;
        }
        Uri data = intent.getData();
        if (data == null || data.getPath() == null) {
            return;
        }
        if (!data.getPath().startsWith("/auth/google/app-return")) {
            return;
        }
        final String url = data.toString();
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().post(() -> getBridge().getWebView().loadUrl(url));
        }
    }
}
