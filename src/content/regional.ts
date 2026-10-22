// Regional reckoning and new-years are standard published pañchāṅga practice;
// language renderings and deity traditions compiled for product use —
// PROVISIONAL pending Jyotiṣa review.

export interface RegionalTradition {
  state: string;             // IAST, e.g. "Mahārāṣṭra"
  aliases: string[];         // ["Maharashtra", "MH"]
  language: string;          // "Marathi"
  reckoning: "amānta" | "pūrṇimānta";
  samvatEra: "śaka" | "vikram";
  newYear: string;           // e.g. "Gudī Padwā — Chaitra Śukla 1"
  rashis: string[];          // exactly 12, Meṣa..Mīna, in the state's major language
  nakshatras: string[];      // exactly 27, Aśvinī..Revatī, same language
  deityTradition: string;    // 1-2 sentences; must contain "PROVISIONAL" if not classically provenanced
  notes: string[];
}

// ——— script-level sequences (12 raśis, 27 nakṣatras, Aśvinī..Revatī) ———

const RASHI_MR = ["मेष","वृषभ","मिथुन","कर्क","सिंह","कन्या","तूळ","वृश्चिक","धनु","मकर","कुंभ","मीन"];
const NAKS_MR = ["अश्विनी","भरणी","कृत्तिका","रोहिणी","मृगशिरा","आर्द्रा","पुनर्वसू","पुष्य","आश्लेषा","मघा","पूर्वा फाल्गुनी","उत्तरा फाल्गुनी","हस्त","चित्रा","स्वाती","विशाखा","अनुराधा","ज्येष्ठा","मूळ","पूर्वाषाढा","उत्तराषाढा","श्रवण","धनिष्ठा","शततारका","पूर्वा भाद्रपदा","उत्तरा भाद्रपदा","रेवती"];

const RASHI_HI = ["मेष","वृषभ","मिथुन","कर्क","सिंह","कन्या","तुला","वृश्चिक","धनु","मकर","कुंभ","मीन"];
const NAKS_HI = ["अश्विनी","भरणी","कृत्तिका","रोहिणी","मृगशिरा","आर्द्रा","पुनर्वसु","पुष्य","आश्लेषा","मघा","पूर्व फाल्गुनी","उत्तर फाल्गुनी","हस्त","चित्रा","स्वाति","विशाखा","अनुराधा","ज्येष्ठा","मूल","पूर्वाषाढ़ा","उत्तराषाढ़ा","श्रवण","धनिष्ठा","शतभिषा","पूर्व भाद्रपदा","उत्तर भाद्रपदा","रेवती"];

const RASHI_TA = ["மேஷம்","ரிஷபம்","மிதுனம்","கடகம்","சிம்மம்","கன்னி","துலாம்","விருச்சிகம்","தனுசு","மகரம்","கும்பம்","மீனம்"];
const NAKS_TA = ["அசுவதி","பரணி","கார்த்திகை","ரோகிணி","மிருகசீரிஷம்","திருவாதிரை","புனர்பூசம்","பூசம்","ஆயில்யம்","மகம்","பூரம்","உத்திரம்","ஹஸ்தம்","சித்திரை","சுவாதி","விசாகம்","அனுஷம்","கேட்டை","மூலம்","பூராடம்","உத்திராடம்","திருவோணம்","அவிட்டம்","சதயம்","பூரட்டாதி","உத்திரட்டாதி","ரேவதி"];

const RASHI_TE = ["మేషం","వృషభం","మిథునం","కర్కాటకం","సింహం","కన్య","తుల","వృశ్చికం","ధనుస్సు","మకరం","కుంభం","మీనం"];
const NAKS_TE = ["అశ్విని","భరణి","కృత్తిక","రోహిణి","మృగశిర","ఆరుద్ర","పునర్వసు","పుష్య","ఆశ్లేష","మఖ","పూర్వ ఫల్గుని","ఉత్తర ఫల్గుని","హస్త","చిత్త","స్వాతి","విశాఖ","అనురాధ","జ్యేష్ఠ","మూల","పూర్వాషాఢ","ఉత్తరాషాఢ","శ్రవణ","ధనిష్ఠ","శతభిష","పూర్వ భాద్రపద","ఉత్తర భాద్రపద","రేవతి"];

const RASHI_KN = ["ಮೇಷ","ವೃಷಭ","ಮಿಥುನ","ಕರ್ಕಾಟಕ","ಸಿಂಹ","ಕನ್ಯಾ","ತುಲಾ","ವೃಶ್ಚಿಕ","ಧನು","ಮಕರ","ಕುಂಭ","ಮೀನ"];
const NAKS_KN = ["ಅಶ್ವಿನಿ","ಭರಣಿ","ಕೃತ್ತಿಕಾ","ರೋಹಿಣಿ","ಮೃಗಶಿರ","ಆರ್ದ್ರಾ","ಪುನರ್ವಸು","ಪುಷ್ಯ","ಆಶ್ಲೇಷಾ","ಮಘಾ","ಪೂರ್ವ ಫಲ್ಗುನಿ","ಉತ್ತರ ಫಲ್ಗುನಿ","ಹಸ್ತ","ಚಿತ್ತಾ","ಸ್ವಾತಿ","ವಿಶಾಖ","ಅನುರಾಧ","ಜ್ಯೇಷ್ಠಾ","ಮೂಲ","ಪೂರ್ವಾಷಾಢ","ಉತ್ತರಾಷಾಢ","ಶ್ರವಣ","ಧನಿಷ್ಠಾ","ಶತಭಿಷ","ಪೂರ್ವ ಭಾದ್ರ","ಉತ್ತರ ಭಾದ್ರ","ರೇವತಿ"];

const RASHI_ML = ["മേടം","ഇടവം","മിഥുനം","കർക്കിടകം","ചിങ്ങം","കന്നി","തുലാം","വൃശ്ചികം","ധനു","മകരം","കുംഭം","മീനം"];
const NAKS_ML = ["അശ്വതി","ഭരണി","കാർത്തിക","രോഹിണി","മകയിരം","തിരുവാതിര","പുനർതം","പൂയം","ആയില്യം","മകം","പൂരം","ഉത്രം","അത്തം","ചിത്തിര","ചോതി","വിശാഖം","അനിഴം","കേട്ട","മൂലം","പൂരാടം","ഉത്രാടം","തിരുവോണം","അവിട്ടം","ചതയം","പൂരുരുട്ടാതി","ഉത്രട്ടാതി","രേവതി"];

const RASHI_BN = ["মেষ","বৃষ","মিথুন","কর্কট","সিংহ","কন্যা","তুলা","বৃশ্চিক","ধনু","মকর","কুম্ভ","মীন"];
const NAKS_BN = ["অশ্বিনী","ভরণী","কৃত্তিকা","রোহিণী","মৃগশিরা","আর্দ্রা","পুনর্বসু","পুষ্য","অশ্লেষা","মঘা","পূর্বফাল্গুনী","উত্তরফাল্গুনী","হস্ত","চিত্রা","স্বাতী","বিশাখা","অনুরাধা","জ্যেষ্ঠা","মূলা","পূর্বাষাঢ়া","উত্তরাষাঢ়া","শ্রবণা","ধনিষ্ঠা","শতভিষা","পূর্বভাদ্রপদা","উত্তরভাদ্রপদা","রেবতী"];

const RASHI_GU = ["મેષ","વૃષભ","મિથુન","કર્ક","સિંહ","કન્યા","તુલા","વૃશ્ચિક","ધનુ","મકર","કુંભ","મીન"];
const NAKS_GU = ["અશ્વિની","ભરણી","કૃતિકા","રોહિણી","મૃગશિર્ષ","અર્દ્રા","પુનર્વસુ","પુષ્ય","અશ્લેષા","મઘા","પૂર્વ ફાલ્ગુની","ઉત્તર ફાલ્ગુની","હસ્ત","ચિત્રા","સ્વાતી","વિશાખા","અનુરાધા","જયેષ્ઠા","મૂળ","પૂર્વાષાઢા","ઉત્તરાષાઢા","શ્રવણ","ધનિષ્ઠા","શતભિષા","પૂર્વ ભાદરપદા","ઉત્તર ભાદરપદા","રેવતી"];

const RASHI_PA = ["ਮੇਖ","ਵਰਕ","ਮਿਥੁਨ","ਕਰਕ","ਸਿੰਘ","ਕੰਨੀ","ਤੁੱਲਾ","ਬਰਿਸ਼ਚਕ","ਧੱਨੂ","ਮੱਕਰ","ਕੁੰਭ","ਮੀਨ"];
const NAKS_PA = ["ਅਸ਼ਵਨੀ","ਭਰਨੀ","ਕ੍ਰਿਤਿਕਾ","ਰੋਹਣੀ","ਮਿਰਗਸ਼ੀਰਾ","ਅਰਦਰਾ","ਪੁਨਰਵਸੁ","ਪੁਸ਼ਿਆ","ਅਸ਼ਲੇਸ਼ਾ","ਮਘਾ","ਪੂਰਵ ਫਾਲਗੁਨੀ","ਉੱਤਰ ਫਾਲਗੁਨੀ","ਹਸਤ","ਚਿਤਰਾ","ਸਵਾਤੀ","ਵਿਸ਼ਾਖਾ","ਅਨੁਰਾਧਾ","ਜੇਠਾ","ਮੂਲ","ਪੂਰਵ ਅਸ਼ਾਢ਼ਾ","ਉੱਤਰ ਅਸ਼ਾਢ਼ਾ","ਸਰਵਣ","ਧਨਿਸ਼ਠਾ","ਸ਼ਤਭਿਸ਼ਾ","ਪੂਰਵ ਭਾਦਰਪਦਾ","ਉੱਤਰ ਭਾਦਰਪਦਾ","ਰੇਵਤੀ"];

const RASHI_OR = ["ମେଷ","ବୃଷ","ମିଥୁନ","କର୍କଟ","ସିଂହ","କନ୍ୟା","ତୁଳା","ବିଶ୍ଚିଖ","ଧନୁ","ମକର","କୁମ୍ଭ","ମୀନ"];
const NAKS_OR = ["ଅଶ୍ୱିନୀ","ଭରଣୀ","କୃତ୍ତିକା","ରୋହିଣୀ","ମୃଗଶିର","ଅର୍ଦ୍ରା","ପୁନର୍ବସୁ","ପୁଷ୍ୟ","ଅଶ୍ଳେଷା","ମଘା","ପୂର୍ବ ଫାଲଗୁନୀ","ଉତ୍ତର ଫାଲଗୁନୀ","ହସ୍ତ","ଚିତ୍ରା","ସ୍ୱାତୀ","ବିଶାଖା","ଅନୁରାଧା","ଜ୍ୟେଷ୍ଠା","ମୂଳ","ପୂର୍ବାଷାଢ଼ା","ଉତ୍ତରାଷାଢ଼ା","ଶ୍ରବଣ","ଧନିଷ୍ଠା","ଶତଭିଷା","ପୂର୍ବ ଭାଦ୍ର","ଉତ୍ତର ଭାଦ୍ର","ରେବତୀ"];

const RASHI_AS = ["মেষ","বৃষ","মিথুন","কৰ্কট","সিংহ","কন্যা","তুলা","বৃশ্চিক","ধনু","মকৰ","কুম্ভ","মীন"];
const NAKS_AS = ["অশ্বিনী","ভৰণী","কৃত্তিকা","ৰোহিণী","মৃগশিৰা","আৰ্দ্ৰা","পুনৰ্বসু","পুষ্য","অশ্লেষা","মঘা","পূৰ্বফাল্গুনী","উত্তৰফাল্গুনী","হস্ত","চিত্ৰা","স্বাতী","বিশাখা","অনুৰাধা","জ্যেষ্ঠা","মূল","পূৰ্বাষাঢ়া","উত্তৰাষাঢ়া","শ্ৰবণা","ধনিষ্ঠা","শতভিষা","পূৰ্বভাদ্ৰপদা","উত্তৰভাদ্ৰপদা","ৰেৱতী"];

const RASHI_EN = ["Meṣa","Vṛṣabha","Mithuna","Karka","Siṃha","Kanyā","Tulā","Vṛścika","Dhanu","Makara","Kumbha","Mīna"];
const NAKS_EN = ["Aśvinī","Bharaṇī","Kṛttikā","Rohiṇī","Mṛgaśīrṣa","Ārdrā","Punarvasu","Puṣya","Āśleṣā","Maghā","Pūrva Phalgunī","Uttara Phalgunī","Hasta","Citrā","Svātī","Viśākhā","Anurādhā","Jyeṣṭhā","Mūla","Pūrva Āṣāḍhā","Uttara Āṣāḍhā","Śravaṇa","Dhaniṣṭhā","Śatabhiṣā","Pūrva Bhādrapadā","Uttara Bhādrapadā","Revatī"];

const VIKAL = "Vikrama new year — Chaitra Śukla 1 (Bāisākhī is Vaiśākha saṅkrānti, not the new year)";

export const INDIAN_STATES: RegionalTradition[] = [
  // ——— states ———
  { state: "Āndhra Pradesh", aliases: ["Andhra Pradesh", "AP", "Andhra"], language: "Telugu", reckoning: "amānta", samvatEra: "śaka", newYear: "Ugādi — Chaitra Śukla 1", rashis: RASHI_TE, nakshatras: NAKS_TE, deityTradition: "Venkateśvara of Tirumala and Śiva–Śakti Āgamic worship dominate; Āḷvār Vaiṣṇava heritage is classically attested.", notes: ["Ugādi pañchāṅga-śravaṇa (Panchāṅga Patrika) is customary."] },
  { state: "Aruṇācal Pradesh", aliases: ["Arunachal Pradesh", "AR", "Arunachal"], language: "English", reckoning: "amānta", samvatEra: "śaka", newYear: "Chaitra Śukla 1 (village calendars vary)", rashis: RASHI_EN, nakshatras: NAKS_EN, deityTradition: "Donyi-Polo and Rangfrah indigenous traditions dominate, with Monpa Buddhism in the west — PROVISIONAL pending review.", notes: ["IAST Sanskrit renderings shown as fallback."] },
  { state: "Assam", aliases: ["AS", "Axom"], language: "Assamese", reckoning: "amānta", samvatEra: "śaka", newYear: "Bohāg Bīhu — Chaitra saṅkrānti (mid-April)", rashis: RASHI_AS, nakshatras: NAKS_AS, deityTradition: "Kāmākhyā Śākta tradition dominates; Śaṅkaradeva's Vaiṣṇava satra heritage is classically attested.", notes: ["Assamese pañchāṅgas follow Sūrya-siddhānta."] },
  { state: "Bihār", aliases: ["Bihar", "BR"], language: "Hindi", reckoning: "pūrṇimānta", samvatEra: "vikram", newYear: VIKAL, rashis: RASHI_HI, nakshatras: NAKS_HI, deityTradition: "Vaiṣṇava, Buddhist and Jaina heritage dominates; contemporary temple practice — PROVISIONAL pending review.", notes: ["Maithili pañchāṅgas are common in Mithilā."] },
  { state: "Chhattīsgaṛh", aliases: ["Chhattisgarh", "CG"], language: "Chhattisgarhi", reckoning: "pūrṇimānta", samvatEra: "vikram", newYear: VIKAL, rashis: RASHI_HI, nakshatras: NAKS_HI, deityTradition: "Mahāmāyā (Ratanpur) and Dantesarī Devī traditions dominate — PROVISIONAL pending review.", notes: ["Standard Devanagari renderings used."] },
  { state: "Goa", aliases: ["GA"], language: "Konkani", reckoning: "amānta", samvatEra: "śaka", newYear: "Gudī Padwā — Chaitra Śukla 1", rashis: RASHI_MR, nakshatras: NAKS_MR, deityTradition: "Śiva–Ganesha parivāra and Śāntadurgā kuladevatā traditions dominate — PROVISIONAL pending review.", notes: ["Renderings follow standard Devanagari Konkani usage."] },
  { state: "Gujarāt", aliases: ["Gujarat", "GJ"], language: "Gujarati", reckoning: "amānta", samvatEra: "vikram", newYear: "Bestu Vāras — Kārtika Śukla 1", rashis: RASHI_GU, nakshatras: NAKS_GU, deityTradition: "Puṣṭimārga Vaiṣṇavism (Śrīnāthjī) and Jaina traditions dominate; classically attested.", notes: ["Amānta months; the year rolls over on Kārtika Śukla 1."] },
  { state: "Haryāṇa", aliases: ["Haryana", "HR"], language: "Hindi", reckoning: "pūrṇimānta", samvatEra: "vikram", newYear: VIKAL, rashis: RASHI_HI, nakshatras: NAKS_HI, deityTradition: "Kurukṣetra Vaiṣṇava heritage with Devī–Bhairū folk traditions — PROVISIONAL pending review.", notes: ["Guggā-naumī and Sūraj-melā are regional observances."] },
  { state: "Himācal Pradesh", aliases: ["Himachal Pradesh", "HP"], language: "Hindi", reckoning: "pūrṇimānta", samvatEra: "vikram", newYear: VIKAL, rashis: RASHI_HI, nakshatras: NAKS_HI, deityTradition: "Devī upāsanā (Jvālāmukhī, Cāmuṇḍā, Śākumbharī) dominates — PROVISIONAL pending review.", notes: ["Devī-Devtā village theogony is regionally specific."] },
  { state: "Jhārkhaṇḍ", aliases: ["Jharkhand", "JH"], language: "Hindi", reckoning: "pūrṇimānta", samvatEra: "vikram", newYear: VIKAL, rashis: RASHI_HI, nakshatras: NAKS_HI, deityTradition: "Adivasi Sarna (sacred-grove) tradition coexists with Devī–Śiva worship — PROVISIONAL pending review.", notes: ["Sarhul and Sohrai are major Adivasi festivals."] },
  { state: "Karṇāṭaka", aliases: ["Karnataka", "KA"], language: "Kannada", reckoning: "amānta", samvatEra: "śaka", newYear: "Ugādi — Chaitra Śukla 1", rashis: RASHI_KN, nakshatras: NAKS_KN, deityTradition: "Vīraśaiva (Liṅgāyat) and Mādhva Vaiṣṇava sampradāyas dominate; classically attested.", notes: ["Candra-māna amānta reckoning per southern pañchāṅga."] },
  { state: "Kerala", aliases: ["KL"], language: "Malayalam", reckoning: "amānta", samvatEra: "śaka", newYear: "Viṣu — Meṣa saṅkrānti (~14 April)", rashis: RASHI_ML, nakshatras: NAKS_ML, deityTradition: "Keraḷa tantric Āgama temple tradition dominates, with Ayyappa and Bhagavatī upāsanā; classically attested.", notes: ["Kolla-varṣam era also in civil use; Viṣu is solar (Meṣa Saṅkrānti)."] },
  { state: "Madhya Pradesh", aliases: ["MP"], language: "Hindi", reckoning: "pūrṇimānta", samvatEra: "vikram", newYear: VIKAL, rashis: RASHI_HI, nakshatras: NAKS_HI, deityTradition: "Śaiva (Mahākāleśvara, Ujjain) and Vaiṣṇava traditions dominate; classically attested.", notes: ["Ujjain is the traditional prime meridian of Indian astronomy."] },
  { state: "Mahārāṣṭra", aliases: ["Maharashtra", "MH"], language: "Marathi", reckoning: "amānta", samvatEra: "śaka", newYear: "Gudī Padwā — Chaitra Śukla 1", rashis: RASHI_MR, nakshatras: NAKS_MR, deityTradition: "Nath/Waghya traditions and Ganesha upāsanā dominate — PROVISIONAL pending review", notes: ["Śaka era is standard in printed Marathi pañchāṅga."] },
  { state: "Manipur", aliases: ["MN"], language: "Meiteilon (Manipuri)", reckoning: "amānta", samvatEra: "śaka", newYear: "Sajibu Cheiraoba — Chaitra Śukla 1", rashis: RASHI_EN, nakshatras: NAKS_EN, deityTradition: "Sanamahī (Meitei) tradition coexists with Caitanya-style Vaiṣṇava Rāsa-līlā — PROVISIONAL pending review.", notes: ["Meitei Mayek renderings pending; IAST fallback shown."] },
  { state: "Meghālaya", aliases: ["Meghalaya", "ML"], language: "Khasi / Garo", reckoning: "amānta", samvatEra: "śaka", newYear: "Chaitra Śukla 1", rashis: RASHI_EN, nakshatras: NAKS_EN, deityTradition: "Khasi Niam Khasi and Garo Songsarek indigenous traditions dominate — PROVISIONAL pending review.", notes: ["No classical pañchāṅga lineage; renderings are fallback."] },
  { state: "Mizorām", aliases: ["Mizoram", "MZ"], language: "Mizo", reckoning: "amānta", samvatEra: "śaka", newYear: "Chaitra Śukla 1", rashis: RASHI_EN, nakshatras: NAKS_EN, deityTradition: "Christian majority with Mizo customary practice — PROVISIONAL pending review.", notes: ["Fallback renderings."] },
  { state: "Nāgāland", aliases: ["Nagaland", "NL"], language: "English", reckoning: "amānta", samvatEra: "śaka", newYear: "Chaitra Śukla 1", rashis: RASHI_EN, nakshatras: NAKS_EN, deityTradition: "Baptist/Christian majority with Angami–Sumi customary genna practice — PROVISIONAL pending review.", notes: ["Fallback renderings."] },
  { state: "Oḍiśā", aliases: ["Odisha", "OR"], language: "Odia", reckoning: "amānta", samvatEra: "śaka", newYear: "Pana Saṅkrānti — Meṣa saṅkrānti (~14 April)", rashis: RASHI_OR, nakshatras: NAKS_OR, deityTradition: "Jagannātha Vaiṣṇava temple tradition dominates, with Śākta and Śaiva streams; classically attested.", notes: ["The Oḍiā Panji counts the year from Meṣa Saṅkrānti."] },
  { state: "Pañjāb", aliases: ["Punjab", "PB"], language: "Punjabi", reckoning: "pūrṇimānta", samvatEra: "vikram", newYear: "Vaiśākhī — Vaiśākha saṅkrānti", rashis: RASHI_PA, nakshatras: NAKS_PA, deityTradition: "Sikh Gurmat tradition dominates; folk Devī and pīr traditions persist — PROVISIONAL pending review.", notes: ["Nānakshāhī calendar is in civil use."] },
  { state: "Rājasthān", aliases: ["Rajasthan", "RJ"], language: "Hindi", reckoning: "pūrṇimānta", samvatEra: "vikram", newYear: VIKAL, rashis: RASHI_HI, nakshatras: NAKS_HI, deityTradition: "Puṣṭimārga Kṛṣṇa upāsanā (Nāthdwārā) and Rāmdevajī folk tradition dominate — PROVISIONAL pending review.", notes: ["Vikrama Saṃvat dominates civil usage."] },
  { state: "Sikkim", aliases: ["SK"], language: "Nepali", reckoning: "amānta", samvatEra: "śaka", newYear: "Chaitra Śukla 1 (Losar also observed)", rashis: RASHI_HI, nakshatras: NAKS_HI, deityTradition: "Nyingma Tibetan Buddhist tradition dominates (Guru Rinpoche heritage) — PROVISIONAL pending review.", notes: ["Devanagari renderings per Nepali usage; the Tibetan calendar is also in use."] },
  { state: "Tamiḻnāḍu", aliases: ["Tamil Nadu", "TN"], language: "Tamil", reckoning: "amānta", samvatEra: "śaka", newYear: "Puthandu — Meṣa saṅkrānti (Chithirai 1, ~14 April)", rashis: RASHI_TA, nakshatras: NAKS_TA, deityTradition: "Śaiva Siddhānta and Murugan upāsanā dominate; Āḷvār–Nayanār heritage is classically attested.", notes: ["Tirukkaṇiṭa pañchāṅgam is the standard almanac lineage."] },
  { state: "Telaṅgāṇa", aliases: ["Telangana", "TS", "TG"], language: "Telugu", reckoning: "amānta", samvatEra: "śaka", newYear: "Ugādi — Chaitra Śukla 1", rashis: RASHI_TE, nakshatras: NAKS_TE, deityTradition: "Venkateśvara and Kakatīya-era Śiva–Śakti traditions dominate; classically attested.", notes: ["Bathukamma and Bōnamulu are major regional observances."] },
  { state: "Tripurā", aliases: ["Tripura", "TR"], language: "Bengali", reckoning: "amānta", samvatEra: "śaka", newYear: "Chaitra Śukla 1 (Poila Boiśākh — Meṣa saṅkrānti — also observed)", rashis: RASHI_BN, nakshatras: NAKS_BN, deityTradition: "Tripurā Sundarī Śākta tradition dominates; classically attested.", notes: ["Kokborok traditions persist alongside Bengali usage."] },
  { state: "Uttar Pradesh", aliases: ["UP"], language: "Hindi", reckoning: "pūrṇimānta", samvatEra: "vikram", newYear: VIKAL, rashis: RASHI_HI, nakshatras: NAKS_HI, deityTradition: "Rāmānandī Vaiṣṇavism (Ayodhyā, Vṛndāvana) and Śaiva traditions dominate; classically attested.", notes: ["The Kumbha-melā Jovian cycle is observed at Prayāgrāja."] },
  { state: "Uttarākhaṇḍ", aliases: ["Uttarakhand", "UK"], language: "Hindi", reckoning: "pūrṇimānta", samvatEra: "vikram", newYear: VIKAL, rashis: RASHI_HI, nakshatras: NAKS_HI, deityTradition: "Nandā Devī Rāja Jāt Śākta tradition dominates; classically attested Himalayan Devī upāsanā.", notes: ["Devī-Devtā village theogony is regionally specific."] },
  { state: "West Bengal", aliases: ["WB", "Paschim Banga"], language: "Bengali", reckoning: "amānta", samvatEra: "śaka", newYear: "Poila Boiśākh — Meṣa saṅkrānti (Boiśākh 1, ~15 April)", rashis: RASHI_BN, nakshatras: NAKS_BN, deityTradition: "Śākta (Kālī, Durgā) and Gauḍīya Vaiṣṇava (Caitanya) traditions dominate; classically attested.", notes: ["Bengali San (Boiśākh 1) uses amānta months with sunrise day-reckoning."] },
  // ——— union territories ———
  { state: "Andaman and Nicobar Islands", aliases: ["AN", "A & N Islands", "Andaman & Nicobar"], language: "Bengali", reckoning: "amānta", samvatEra: "śaka", newYear: "Chaitra Śukla 1 (Poila Boiśākh — Meṣa saṅkrānti — widely observed)", rashis: RASHI_BN, nakshatras: NAKS_BN, deityTradition: "Settler Śākta–Vaiṣṇava practice with Nicobarese animist and Karen Buddhist pockets — PROVISIONAL pending review.", notes: ["Renderings follow settler Bengali usage."] },
  { state: "Chandigarh", aliases: ["CH", "Chd"], language: "Hindi", reckoning: "pūrṇimānta", samvatEra: "vikram", newYear: VIKAL, rashis: RASHI_HI, nakshatras: NAKS_HI, deityTradition: "Cāṇḍī Devī folk traditions (Cāṇḍī-maṇḍir, Mānasā-devī) dominate — PROVISIONAL pending review.", notes: ["Punjabi pañchāṅgas are equally in use."] },
  { state: "Dadra and Nagar Haveli and Daman and Diu", aliases: ["DNHDD", "DNH and DD", "Daman and Diu", "Dadra and Nagar Haveli"], language: "Gujarati", reckoning: "amānta", samvatEra: "śaka", newYear: "Chaitra Śukla 1 (Bestu Vāras also observed)", rashis: RASHI_GU, nakshatras: NAKS_GU, deityTradition: "Varlī–Kokṇā Devī worship alongside Gujarati Vaiṣṇava practice — PROVISIONAL pending review.", notes: ["Renderings follow Gujarati usage."] },
  { state: "Delhi", aliases: ["DL", "NCT of Delhi", "New Delhi"], language: "Hindi", reckoning: "pūrṇimānta", samvatEra: "vikram", newYear: VIKAL, rashis: RASHI_HI, nakshatras: NAKS_HI, deityTradition: "Yogamāyā and Bhairava shrine traditions dominate — PROVISIONAL pending review.", notes: ["Vikrama Saṃvat dominates printed pañchāṅga."] },
  { state: "Jammu and Kashmir", aliases: ["Jammu & Kashmir", "J&K", "JK", "Kashmir"], language: "Kashmiri", reckoning: "pūrṇimānta", samvatEra: "vikram", newYear: VIKAL, rashis: RASHI_HI, nakshatras: NAKS_HI, deityTradition: "Kāśmīra Śaivism heritage; contemporary Raghunāth and Devī upāsanā — PROVISIONAL pending review.", notes: ["Devanagari Kashmiri renderings; Herath (Śivarātri) is the hallmark festival."] },
  { state: "Ladakh", aliases: ["LA"], language: "Ladakhi (Bhoti)", reckoning: "pūrṇimānta", samvatEra: "vikram", newYear: VIKAL, rashis: RASHI_HI, nakshatras: NAKS_HI, deityTradition: "Tibetan Buddhist (Gelug, Drukpa) tradition dominates alongside Hindu temple service — PROVISIONAL pending review.", notes: ["Tibetan script and calendar in civil use; Devanagari fallback shown."] },
  { state: "Lakṣadwīp", aliases: ["Lakshadweep", "LD"], language: "Malayalam", reckoning: "amānta", samvatEra: "śaka", newYear: "Chaitra Śukla 1", rashis: RASHI_ML, nakshatras: NAKS_ML, deityTradition: "Sunni Muslim tradition dominates with local maulid custom — PROVISIONAL pending review.", notes: ["Renderings follow Kerala usage."] },
  { state: "Puducherry", aliases: ["PY", "Pondicherry"], language: "Tamil", reckoning: "amānta", samvatEra: "śaka", newYear: "Puthandu — Meṣa saṅkrānti (Chithirai 1, ~14 April)", rashis: RASHI_TA, nakshatras: NAKS_TA, deityTradition: "Tamil Śaiva–Vaiṣṇava temple traditions dominate; classically attested.", notes: ["Karaikal, Mahe and Yanam enclaves follow surrounding-state usage."] },
];

export function traditionByState(name: string): RegionalTradition | undefined {
  const q = name.trim().toLowerCase();
  return INDIAN_STATES.find(
    (t) => t.state.toLowerCase() === q || t.aliases.some((a) => a.toLowerCase() === q),
  );
}