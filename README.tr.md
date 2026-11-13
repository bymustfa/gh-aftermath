# gh-aftermath

[English](README.md) | [Türkçe](README.tr.md)

[![CI](https://github.com/bymustfa/gh-aftermath/actions/workflows/ci.yml/badge.svg)](https://github.com/bymustfa/gh-aftermath/actions/workflows/ci.yml)
[![CodeQL](https://github.com/bymustfa/gh-aftermath/actions/workflows/codeql.yml/badge.svg)](https://github.com/bymustfa/gh-aftermath/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://github.com/bymustfa/gh-aftermath/actions/workflows/scorecard.yml/badge.svg)](https://github.com/bymustfa/gh-aftermath/actions/workflows/scorecard.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/badge/npm-not%20yet%20published-lightgrey)](#hizli-baslangic)

GitHub kesintisinden sonra kuruluşu toparlamak için kendi sunucunuzda çalışan bir web arayüzü: başarısız webhook teslimatlarını yeniden oynatır, hâlâ takılı Actions işlerini temizler.

## Sorun

Actions ya da webhook'lar bozulunca geride iki tür iş kalır. Webhook teslimatları başarısız olur ya da hiç yanıt alamaz. İş akışı çalıştırmaları `queued` durumunda bekler, ya da bitmesi gerekirken uzun süre `in_progress` kalır. Bunları depo depo elle yeniden oynatmak, kısa bir kesintiyi uzun bir öğleden sonraya çevirir.

9 Kasım 2026'da GitHub, Actions ve webhook'larda bir bozulma bildirdi. Aynı aralık, [Hacker News](https://news.ycombinator.com/item?id=50458532) üzerinde de konuşuldu. gh-aftermath bu tür bir temizlik için yerel bir araçtır. Bir durum sayfası değildir ve GitHub adına konuşmaz.

## Özellikler

- Kuruluş genelinde, UTC zaman aralığına göre tarama
- Depo kancaları, kuruluş kancaları ve GitHub App teslimatları için toplu webhook yeniden teslimi
- Kuyrukta ya da sürmekte olan Actions işleri için iptal, zorla iptal ve yeniden çalıştırma
- Teslimat ve iş listelerinde arama ve süzgeçler
- Varsayılan olarak dry-run: bir şey gönderilmeden önce isteğin tam yolu görünür
- İndirilebilir JSON ve Markdown raporları
- Belirteç olmadan ekranı gezmek için örnek verili demo modu

## Demo

![Demo: aralık seçimi, dry-run yeniden teslim, sonra rapor](docs/demo.gif)

![Tarama sonucu: başarısız teslimatlar ve takılı işler](docs/after-results-light.png)

![Dry-run raporu](docs/after-report-light.png)

## Hızlı başlangıç

Node.js 20 veya daha yenisi. Paket henüz npm'de yok.

```bash
git clone https://github.com/bymustfa/gh-aftermath.git
cd gh-aftermath
npm ci
npm run build
npm start -- --demo
```

http://localhost:8787 adresini açın. Demo modu örnek kuruluş `northwind` kullanır ve GitHub'ı çağırmaz.

Canlı mod aynı sunucudur, `--demo` olmadan. `GITHUB_TOKEN` ve `GITHUB_ORG` verin, ya da belirteç olmadan başlatıp sayfadaki alana yapıştırın. Sayfadan girilen belirteç yalnızca o sunucu sürecinin belleğinde durur.

```bash
npm start
```

`npx` yakında, paket yayımlandıktan sonra:

```bash
npx gh-aftermath --demo
```

Docker imajı yayımlanmadı. Yerelde derleyin:

```bash
docker build -t gh-aftermath .
docker run --rm -p 8787:8787 gh-aftermath --demo
docker run --rm -p 8787:8787 -e GITHUB_TOKEN -e GITHUB_ORG=kurulusunuz gh-aftermath
```

| Değişken | Amaç |
| --- | --- |
| `GITHUB_TOKEN` | Tarama, yeniden teslim ve Actions için kişisel erişim belirteci |
| `GITHUB_ORG` | Formda görünen kuruluş |
| `GITHUB_APP_ID` | App kancası teslimatları için uygulama kimliği |
| `GITHUB_APP_PRIVATE_KEY` veya `GITHUB_APP_PRIVATE_KEY_PATH` | Uygulama özel anahtarı |
| `GITHUB_APP_INSTALLATION_ID` | Belirteç yerine uygulama ile tarama |
| `PORT` / `HOST` | Varsayılan `8787` ve `0.0.0.0` |
| `DEMO=1` | `--demo` ile aynı |

## Belirteç yetkileri

Klasik kişisel erişim belirteci:

| Yetki | Kullanım |
| --- | --- |
| `repo` | Özel depolar ve Actions iptal, zorla iptal, yeniden çalıştırma |
| `read:org` | Kuruluş depolarını listeleme |
| `admin:repo_hook` | Depo webhook teslimatları ve yeniden teslim |
| `admin:org_hook` | Kuruluş webhook teslimatları ve yeniden teslim |

İnce ayarlı belirteç, temizlediğiniz kuruluşla sınırlı:

- Metadata: Read
- Actions: Read and write
- Webhooks: Read and write
- Administration: Read, kancaları listelemek bunu gerektiriyorsa
- Organization webhooks: Read and write, kuruluş kancaları için

GitHub App kurulumu: Actions read and write, Webhooks read and write, Metadata read. App teslimatları (`/app/hook/...`) uygulama JWT'si ile kimlik doğrular; `GITHUB_APP_ID` ve özel anahtar gerekir. Taramayı belirteç yerine uygulama yapacaksa `GITHUB_APP_INSTALLATION_ID` de gerekir.

Kesinti bitince belirteci iptal edin.

## Güvenlik

Aracı kendiniz çalıştırın. Belirteç ortam değişkeninden ya da sayfadaki maskeli alandan okunur ve yalnızca o süreç için bellekte tutulur. Diske yazılmaz, tarayıcıda saklanmaz, rapora ve günlüklere kopyalanmaz. Dry-run varsayılandır: GitHub, dry-run kapatılıp onaylanınca çağrılır. Bir güvenlik açığını nasıl bildireceğiniz [SECURITY.md](SECURITY.md) dosyasındadır.

## Alternatifler

GitHub'ın kendi yeniden teslim örneği [tek depo için bir betiktir](https://docs.github.com/en/webhooks/using-webhooks/automatically-redelivering-failed-deliveries-for-a-repository-webhook). `webhook-redeliver-action` teslimatları tek bir depoyu Actions içinden yeniden oynatır. [Hookdeck](https://hookdeck.com/) olayları yönlendirmek, incelemek ve yeniden oynatmak için bir webhook platformudur. gh-aftermath, kesinti aralığı için kuruluş genelinde bir geçiştir: başarısız teslimatlar ve takılı Actions işleri birlikte, sizin denetlediğiniz bir makinede, saklayabileceğiniz bir raporla.

## İlgili

[hook-stage](https://github.com/bymustfa/hook-stage) yerel webhook geliştirme ve inceleme içindir. gh-aftermath bir kesintiden sonraki toparlanma içindir.

## Katkı

[CONTRIBUTING.md](CONTRIBUTING.md) dosyasına bakın. Yeni gelenler için işaretlenmiş konular: [good first issues](https://github.com/bymustfa/gh-aftermath/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22).

## Lisans

[MIT](LICENSE)
