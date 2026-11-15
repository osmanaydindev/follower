// Turkish is the reference dictionary: `Dict` is derived from this file, so a key
// missing from en.ts is a compile error, not a blank spot on the page.
//
// Register: "siz". Resmî ama mesafeli değil — kullanıcıya bir şey satmaya değil,
// ne yaptığımızı anlatmaya çalışan bir ton.
export const tr = {
  code: 'tr',
  htmlLang: 'tr',
  localeTag: 'tr-TR',
  name: 'Türkçe',

  meta: {
    title: 'Follower — Instagram takipçi analizi',
    description:
      'Sizi geri takip etmeyenleri, hayranlarınızı ve karşılıklı takipleşmelerinizi sade bir ekranda görün. Şifreniz saklanmaz, verileriniz satılmaz.',
    panelTitle: 'Panel — Follower',
    loginTitle: 'Giriş — Follower',
  },

  common: {
    loading: 'Yükleniyor…',
    retry: 'Tekrar deneyin',
    cancel: 'Vazgeç',
    close: 'Kapat',
    back: 'Geri',
    errorTitle: 'İşlem tamamlanamadı',
    skipToContent: 'İçeriğe geç',
    openMenu: 'Menüyü aç',
    theme: 'Tema',
    themeLight: 'Açık tema',
    themeDark: 'Koyu tema',
    language: 'Dil',
  },

  nav: {
    brand: 'Follower',
    what: 'Ne yapar',
    trust: 'Güvence',
    install: 'Ana ekrana ekleme',
    faq: 'Sorular',
    analyze: 'Analize başlayın',
    panel: 'Panelim',
  },

  hero: {
    badge: 'Instagram takipçi analizi',
    titleLead: 'Sizi kimler gerçekten',
    titleAccent: 'takip ediyor?',
    subtitle:
      'Takip ettiğiniz hâlde sizi geri takip etmeyenler, sizi takip ettiği hâlde sizin takip etmedikleriniz ve karşılıklı bağlantılarınız — hepsi tek bir sade ekranda.',
    cta: 'Analize başlayın',
    ctaSecondary: 'Nasıl çalışır',
    note: 'Kurulum gerekmez. Tarayıcıda çalışır, dilerseniz telefonunuzun ana ekranına ekleyebilirsiniz.',
    mockupLabel: 'Uygulamanın örnek verilerle hazırlanmış önizlemesi',
  },

  demo: {
    name: 'Deniz Yılmaz',
    handle: 'denizyilmaz',
    posts: 'Gönderi',
    followers: 'Takipçi',
    following: 'Takip',
    tabMutual: 'Karşılıklı',
    tabNotBack: 'Geri takip etmeyen',
    tabFans: 'Hayran',
    hint: 'Sekmelere dokunabilirsiniz',
  },

  features: {
    eyebrow: 'Ne yapar',
    title: 'Dört soruya net cevap',
    subtitle: 'Yorum yok, tahmin yok. Yalnızca listeler ve sayılar.',
    items: [
      {
        key: 'notBack',
        title: 'Geri takip etmeyenler',
        body: 'Takip ettiğiniz hâlde sizi takip etmeyen hesaplar. Dilerseniz tek tek takibi bırakabilirsiniz.',
      },
      {
        key: 'fans',
        title: 'Hayranlarınız',
        body: 'Sizi takip eden ama sizin takip etmediğiniz hesaplar. İsterseniz takipçilerinizden çıkarabilirsiniz.',
      },
      {
        key: 'mutuals',
        title: 'Karşılıklı takipleşme',
        body: 'Birbirinizi takip ettiğiniz hesapların tam listesi ve güncel sayısı.',
      },
      {
        key: 'history',
        title: 'Değişim takibi',
        body: 'İkinci analizden itibaren sizi kimin bıraktığını ve kimin yeni takip ettiğini gösterir.',
      },
    ],
  },

  trust: {
    eyebrow: 'Güvence',
    title: 'Neden güvenle kullanabilirsiniz',
    subtitle:
      'Verilerinizle ne yaptığımızı da, ne yapmadığımızı da açıkça yazıyoruz. Bu bölümü okumadan devam etmenizi beklemiyoruz.',
    items: [
      {
        key: 'password',
        tone: 'success',
        title: 'Şifreniz bizde kalmaz',
        body: 'Şifreniz yalnızca giriş isteğinin gönderildiği an kullanılır ve hemen ardından bellekten silinir. Diskte, veritabanında veya kayıtlarda hiçbir yerde tutulmaz; elimizde kalan tek şey Instagram’ın verdiği oturum anahtarıdır.',
      },
      {
        key: 'protect',
        tone: 'info',
        title: 'Hesabınız için temkinli çalışırız',
        body: 'Listeleriniz sayfa sayfa, aralarında bekleyerek alınır; Instagram bir sınır koyduğunda ısrar etmeyiz, bekleriz. Analizin bir iki dakika sürmesinin sebebi tam olarak budur. Acele etmemek, hesabınızı korumanın en iyi yoludur.',
      },
      {
        key: 'control',
        tone: 'success',
        title: 'Sizin yerinize hiçbir şey yapmayız',
        body: 'Adınıza gönderi paylaşmaz, mesaj göndermez, kimseyi takip etmeyiz. Takibi bırakma ve takipçi çıkarma işlemleri yalnızca siz onayladığınızda, tek tek yapılır.',
      },
      {
        key: 'data',
        tone: 'success',
        title: 'Verileriniz satılmaz',
        body: 'Reklam ağı, izleme kodu ve analitik aracı kullanmıyoruz. Sakladığımız tek şey, “sizi kim bıraktı” sorusunu cevaplayabilmek için tuttuğumuz son takipçi listenizin bir kopyası. Çıkış yaptığınızda oturumunuz silinir.',
        linkLabel: 'Verilerimi nasıl silerim?',
      },
    ],
  },

  install: {
    eyebrow: 'Ana ekrana ekleme',
    title: 'Uygulama gibi, mağazasız',
    subtitle:
      'Follower’ı telefonunuzun ana ekranına ekleyebilirsiniz. Eklediğinizde adres çubuğu olmadan, tam ekran açılır ve diğer uygulamalarınızın yanında durur.',
    osLabel: 'İşletim sistemi',
    ios: 'iPhone / iPad',
    android: 'Android',
    detected: 'Cihazınıza göre seçtik, değiştirebilirsiniz.',
    stepLabel: 'Adım',
    stepOf: '{n} / {total}',
    prev: 'Önceki adım',
    next: 'Sonraki adım',
    installNow: 'Ana ekrana ekle',
    installNowHint: 'Tarayıcınız doğrudan eklemeyi destekliyor; adımları izlemenize gerek yok.',
    httpsNote:
      'Android’de doğrudan ekleme düğmesi yalnızca güvenli (https) bağlantıda görünür. Böyle bir durumda adımları elle izleyebilirsiniz; iPhone’da elle ekleme her koşulda çalışır.',
    iosSteps: [
      {
        title: 'Sayfayı Safari’de açın',
        body: 'Ana ekrana ekleme seçeneği Safari’de bulunur. Başka bir tarayıcıdaysanız bu adresi Safari’de açmanız yeterli.',
        caption: 'Safari · adres çubuğu',
      },
      {
        title: 'Paylaş düğmesine dokunun',
        body: 'Ekranın altındaki araç çubuğunda, içinden yukarı ok çıkan kare simge. Dokununca paylaşım menüsü açılır.',
        caption: 'Paylaş',
      },
      {
        title: '“Ana Ekrana Ekle”yi seçin',
        body: 'Açılan menüyü biraz yukarı kaydırın. Kare içinde artı işareti olan satır budur.',
        caption: 'Ana Ekrana Ekle',
      },
      {
        title: '“Ekle”ye dokunun',
        body: 'Dilerseniz adı kısaltabilirsiniz. Onayladığınız anda simge ana ekranınızda belirir.',
        caption: 'Eklendi',
      },
    ],
    androidSteps: [
      {
        title: 'Sayfayı Chrome’da açın',
        body: 'Ekleme seçeneği Chrome’da bulunur. Samsung Internet’te de benzer bir seçenek vardır.',
        caption: 'Chrome · adres çubuğu',
      },
      {
        title: 'Sağ üstteki menüyü açın',
        body: 'Adres çubuğunun sağındaki üç nokta simgesine dokunun.',
        caption: 'Menü',
      },
      {
        title: '“Uygulamayı yükle”yi seçin',
        body: 'Bazı sürümlerde “Ana ekrana ekle” yazar; ikisi de aynı işi yapar.',
        caption: 'Uygulamayı yükle',
      },
      {
        title: '“Yükle”yi onaylayın',
        body: 'Simge hem ana ekranınıza hem de uygulama çekmecenize eklenir.',
        caption: 'Yüklendi',
      },
    ],
    phoneAlt: 'Ana ekrana ekleme adımlarının canlandırması',
  },

  faq: {
    eyebrow: 'Sorular',
    title: 'Sık sorulanlar',
    items: [
      {
        q: 'Şifrem sizde saklanıyor mu?',
        a: 'Hayır. Şifreniz yalnızca giriş isteği gönderilirken kullanılır ve hemen ardından silinir; hiçbir yere yazılmaz. Sakladığımız tek şey Instagram’ın girişten sonra verdiği oturum anahtarıdır, onu da “Çıkış yap” dediğiniz anda sileriz.',
      },
      {
        q: 'Hesabım için bir risk var mı?',
        a: 'Hesap kapanmasıyla karşılaşmadık. Instagram zaman zaman alışılmadık bir konumdan bağlanıldığını görüp bir doğrulama kodu isteyebilir; bu normal bir güvenlik adımıdır ve akış kodu girdikten sonra devam eder. Bunu en aza indirmek için isteklerimizi yavaş, aralıklı ve sırayla gönderir, Instagram bizi yavaşlattığında ısrar etmeyiz.',
      },
      {
        q: 'Analiz neden bir iki dakika sürüyor?',
        a: 'Listeler sayfa sayfa geliyor ve aralara bilerek bekleme koyuyoruz. Hızlı çekmek, hesabınızı gereksiz yere riske atmanın en kolay yolu olurdu. Bu yavaşlık bir eksiklik değil, bilinçli bir tercih.',
      },
      {
        q: 'İki aşamalı doğrulama kullanıyorum, çalışır mı?',
        a: 'Evet. Giriş sırasında kod istenirse aynı ekranda kodu girersiniz, akış oradan kesintisiz devam eder.',
      },
      {
        q: 'Benim adıma bir işlem yapılıyor mu?',
        a: 'Hayır. Gönderi paylaşmaz, mesaj göndermez, kimseyi takip etmeyiz. Takibi bırakma ve takipçi çıkarma işlemleri yalnızca siz onay kutusunu onayladığınızda, tek tek gerçekleşir.',
      },
      {
        q: 'Verilerimi nasıl sildirebilirim?',
        a: 'Panelden “Çıkış yap” demeniz oturumunuzu sunucudan siler. Takipçi listenizin kopyasının da silinmesini isterseniz veri silme sayfasındaki adımı izleyebilirsiniz.',
      },
    ],
  },

  footer: {
    tagline: 'Instagram takipçi analizi. Sade, açık sözlü, reklamsız.',
    product: 'Ürün',
    legal: 'Yasal',
    privacy: 'Gizlilik',
    terms: 'Kullanım koşulları',
    deletion: 'Verilerimi sil',
    disclaimer:
      'Follower, Instagram veya Meta ile ilişkili değildir ve onlar tarafından onaylanmamıştır. Yalnızca kendi hesabınızın verisini analiz eder.',
    rights: 'Tüm hakları saklıdır.',
  },

  login: {
    title: 'Instagram ile giriş',
    subtitle:
      'Kendi hesabınızın takipçi verisini analiz edebilmemiz için Instagram hesabınıza giriş yapmanız gerekiyor.',
    username: 'Kullanıcı adı',
    usernamePlaceholder: 'kullaniciadi',
    password: 'Şifre',
    showPassword: 'Şifreyi göster',
    hidePassword: 'Şifreyi gizle',
    submit: 'Giriş yapın ve analiz edin',
    submitting: 'Giriş yapılıyor…',
    missing: 'Kullanıcı adı ve şifre gereklidir.',
    riskTitle: 'Girişten önce bilmeniz gerekenler',
    riskItems: [
      'Şifreniz yalnızca bu giriş isteği için kullanılır ve hiçbir yere kaydedilmez.',
      'Instagram zaman zaman bir doğrulama kodu isteyebilir. Bu normal bir güvenlik adımıdır; kodu bir sonraki ekranda girersiniz.',
      'Bir kez giriş yapmanız yeterlidir. Sonuçlarınız saklanır, gerektiğinde yeniden analiz edebilirsiniz.',
    ],
    challengeTitle: 'Doğrulama kodu',
    challengeSubtitle:
      'Instagram size bir kod gönderdi (uygulama, e-posta veya SMS yoluyla). Kodu aşağıya girin.',
    code: 'Kod',
    verify: 'Doğrulayın',
    verifying: 'Doğrulanıyor…',
    codeMissing: 'Lütfen kodu girin.',
    startOver: 'Baştan başlayın',
  },

  panel: {
    logout: 'Çıkış yap',
    loggingOut: 'Çıkılıyor…',
    posts: 'Gönderi',
    followers: 'Takipçi',
    following: 'Takip',
    ctaTitle: 'İlişki analizi',
    ctaBody:
      'Sizi geri takip etmeyenleri, hayranlarınızı ve karşılıklı takipleşmelerinizi görmek için analizi başlatın.',
    analyze: 'Analizi başlat',
    analyzing: 'Analiz ediliyor…',
    reanalyze: 'Yeniden analiz et',
    lastUpdated: 'Son güncelleme',
    cooldown: '{m} dk sonra deneyin',
    cooldownReason:
      'Instagram istekleri geçici olarak sınırladı. Israr etmek süreyi uzattığı için kısa bir ara veriyoruz.',
    summaryTitle: 'Özet',
    cardMutuals: 'Karşılıklı takipleşme',
    cardMutualsHint: 'Birbirinizi takip edenler',
    cardNotBack: 'Geri takip etmeyenler',
    cardNotBackHint: 'Takip ettiğiniz ama sizi takip etmeyenler',
    cardFans: 'Hayranlarınız',
    cardFansHint: 'Sizi takip eden ama sizin etmedikleriniz',
    historyTitle: 'Geçen sefere göre değişim',
    cardUnfollowed: 'Takipten çıkanlar',
    cardUnfollowedHint: 'Önceki analizde vardı, şimdi yok',
    cardNewFollowers: 'Yeni takipçiler',
    cardNewFollowersHint: 'Önceki analizden sonra takip edenler',
    firstRunTitle: 'İlk analiziniz kaydedildi',
    firstRunBody:
      'Bir sonraki analizde “sizi kim bıraktı” ve “kim yeni takip etti” sorularını da cevaplayabileceğiz. Karşılaştırma yapabilmek için bu listeyi sakladık.',
    phaseFollowers: 'Takipçiler',
    phaseFollowing: 'Takip edilenler',
    phaseSaving: 'Sonuçlar hesaplanıyor',
    phaseFetching: '{phase} alınıyor',
    progressPatience:
      'Listeler sayfa sayfa ve aralarında beklenerek alınıyor. Bu yavaşlık, hesabınızın gereksiz yere işaretlenmemesi için bilinçli olarak var. Lütfen sayfayı kapatmayın.',
    tabs: {
      mutuals: 'Karşılıklı',
      notFollowingBack: 'Geri takip etmeyenler',
      fans: 'Hayranlarınız',
      followers: 'Takipçiler',
      following: 'Takip edilenler',
      unfollowed: 'Takipten çıkanlar',
      newFollowers: 'Yeni takipçiler',
    },
    tabsLabel: 'Liste seçimi',
    search: 'Arayın · {n} kişi',
    empty: 'Burada kimse yok',
    emptyFiltered: 'Eşleşen kimse bulunamadı',
    loadMore: 'Daha fazla göster',
    showing: '{shown} / {total} gösteriliyor',
    rowStats: '{posts} gönderi · {followers} takipçi · {following} takip',
    rowStatsLoading: 'yükleniyor…',
    privateAccount: 'Gizli hesap',
    verifiedAccount: 'Onaylı hesap',
    actionUnfollow: 'Takibi bırak',
    actionRemove: 'Takipçiden çıkar',
    actionUnfollowDone: 'Bırakıldı',
    actionRemoveDone: 'Çıkarıldı',
    noteBlocked: 'Şu an yapılamıyor',
    noteNotFollowing: 'Zaten takip etmiyorsunuz',
    confirmUnfollowTitle: 'Takibi bırakmak istiyor musunuz?',
    confirmUnfollowBody: '@{username} hesabını takip etmeyi bırakacaksınız.',
    confirmRemoveTitle: 'Takipçiden çıkarmak istiyor musunuz?',
    confirmRemoveBody:
      '@{username} artık sizi takip etmeyecek. Takipçileriniz arasından çıkarılsın mı?',
    blockedNotice:
      'Instagram bu işlemleri geçici olarak sınırladı. Düğmeler {m} dakika boyunca kapalı kalacak; bu sürede denememek en iyisi.',
    errorNetwork: 'Sunucuya şu anda ulaşılamıyor. Bağlantınızı kontrol edip tekrar deneyin.',
    errorSession: 'Instagram oturumunuz geçerliliğini yitirmiş. Lütfen yeniden giriş yapın.',
    errorThrottled: 'Instagram istekleri sınırladı. 15 dakika sonra tekrar deneyebilirsiniz.',
    errorEmpty:
      'Instagram boş bir liste döndürdü. Bu bir aktarım hatası; kaydetmiyoruz, aksi hâlde bir sonraki analizde herkes sizi bırakmış gibi görünürdü.',
    errorGeneric: 'Analiz tamamlanamadı.',
    sessionExpired: 'Oturumunuzun süresi dolmuş. Lütfen yeniden giriş yapın.',
  },

  viewers: {
    title: 'Profilime kim baktı?',
    lead: 'Bu bilgiyi hiçbir uygulama gösteremez; biz de göstermiyoruz.',
    body: [
      'Instagram, profilinize kimin baktığını hiçbir arayüzünde paylaşmıyor. Resmî API’de yok, “Bilgilerini indir” dosyasında yok, uygulamanın kendi kullandığı uçlarda da yok.',
      'Dolayısıyla bu bilgiyi gösterdiğini söyleyen bir uygulama ya tahmin üretiyor ya da doğrudan uyduruyor. İkisi de aynı kapıya çıkıyor: ekranda gördüğünüz isimlerin, profilinizi görüntüleyen kişilerle bir ilgisi yok.',
      'Size gerçek olmayan bir şey göstermektense hiçbir şey göstermemeyi tercih ediyoruz.',
    ],
    listTitle: 'Bu veri nerelerde yok',
    list: [
      'Resmî Graph API’de yok',
      '“Bilgilerini indir” dosyasında yok',
      'Uygulamanın kendi kullandığı uçlarda da yok',
    ],
    back: 'Ana sayfaya dönün',
  },

  privacy: {
    title: 'Gizlilik politikası',
    updated: 'Son güncelleme: 15 Kasım 2026',
    sections: [
      {
        heading: 'Kısaca',
        body: [
          'Reklam yok, izleme kodu yok, analitik yok. Verilerinizi kimseye satmıyor, kimseyle paylaşmıyoruz. Tuttuğumuz her şey, siz istediğinizde siliniyor.',
        ],
      },
      {
        heading: 'Neleri topluyoruz',
        body: [
          'Instagram kullanıcı adınızı.',
          'Instagram’ın girişten sonra verdiği oturum anahtarını. Şifrenizi değil — şifreniz yalnızca giriş isteği sırasında kullanılır ve o istekten hemen sonra bellekten silinir; hiçbir yere yazılmaz.',
          'En son analizinizdeki takipçi listenizin bir kopyasını (kullanıcı adı, görünen ad, profil fotoğrafı adresi ve hesap numarası). “Sizi kim takipten çıktı” sorusunu ancak önceki listeyle karşılaştırarak cevaplayabildiğimiz için saklıyoruz.',
        ],
      },
      {
        heading: 'Neleri toplamıyoruz',
        body: [
          'Mesajlarınızı, gönderilerinizi, beğenilerinizi veya konumunuzu okumuyoruz.',
          'Reklam amaçlı çerez takibi yapmıyoruz. Kullandığımız tek çerezler, oturumunuzu açık tutan teknik çerez ile seçtiğiniz dil ve tema tercihidir.',
          'Üçüncü taraf bir analitik aracı yüklemiyoruz.',
        ],
      },
      {
        heading: 'Veriler nerede tutuluyor',
        body: [
          'Veriler, kiraladığımız bir sunucudaki dosyalarda tutuluyor. Bulut depolama veya üçüncü taraf bir veritabanı hizmeti kullanılmıyor.',
          'Oturum anahtarları ve takipçi listesi kopyaları, yalnızca sunucu kullanıcısının okuyabileceği izinlerle yazılıyor.',
        ],
      },
      {
        heading: 'Veriler ne kadar süre kalıyor',
        body: [
          'Oturum: “Çıkış yap” dediğiniz anda silinir. Hiçbir şey yapmazsanız 60 gün sonra kendiliğinden geçersiz olur.',
          'Takipçi listesi kopyası: bir sonraki analizde üzerine yazılır; talebiniz üzerine tamamen silinir.',
        ],
      },
      {
        heading: 'Instagram ile ilişkimiz',
        body: [
          'Follower bağımsız bir araçtır; Instagram veya Meta ile hiçbir ilişkisi yoktur ve onlar tarafından onaylanmamıştır. Verilerinizi Instagram’dan kendi oturumunuzla okuyoruz; Instagram’ın kendi gizlilik politikası ayrıca geçerlidir.',
        ],
      },
      {
        heading: 'İletişim',
        body: ['Soru ve silme talepleriniz için: omnaydin1453@gmail.com'],
      },
    ],
  },

  terms: {
    title: 'Kullanım koşulları',
    updated: 'Son güncelleme: 15 Kasım 2026',
    sections: [
      {
        heading: 'Hizmet ne yapar',
        body: [
          'Follower, kendi Instagram hesabınızın takipçi ve takip listelerini karşılaştırır; size kimin geri takip etmediğini, kimin hayranınız olduğunu ve karşılıklı takipleşmelerinizi gösterir. Başka bir kişinin hesabını analiz etmek için kullanılamaz.',
        ],
      },
      {
        heading: 'Teknik çerçeve ve sorumluluk',
        body: [
          'Takipçi listeleri, Instagram’ın resmî olarak belgelenmemiş uçlarından alınır. Bu durum Instagram’ın kullanım koşullarıyla çelişebilir ve hesabınızda geçici bir kısıtlamaya ya da ek doğrulama istenmesine yol açabilir.',
          'Bu olasılığı azaltmak için istekleri yavaş, aralıklı ve sırayla gönderiyor, Instagram bir sınır koyduğunda bekliyoruz. Yine de tüm riski ortadan kaldırdığımızı iddia edemeyiz. Hizmeti kullanmayı seçtiğinizde bunu bildiğinizi kabul etmiş olursunuz.',
        ],
      },
      {
        heading: 'Yapılmaması gerekenler',
        body: [
          'Size ait olmayan bir hesapla giriş yapmak.',
          'Hizmeti otomatik araçlarla yormak veya toplu takip/takipten çıkma işlemleri için kullanmak.',
          'Elde ettiğiniz listeleri taciz veya istenmeyen ileti amacıyla kullanmak.',
        ],
      },
      {
        heading: 'Garanti ve sınırlar',
        body: [
          'Hizmet “olduğu gibi” sunulur. Instagram arayüzünü değiştirdiğinde analiz geçici olarak çalışmayabilir.',
          'Hesabınızda oluşabilecek kısıtlamalardan, veri kaybından veya hizmet kesintisinden doğan dolaylı zararlardan sorumlu tutulamayız.',
        ],
      },
      {
        heading: 'Değişiklikler',
        body: [
          'Bu koşullar değiştiğinde bu sayfadaki tarih güncellenir. Hizmeti kullanmaya devam etmeniz, güncel koşulları kabul ettiğiniz anlamına gelir.',
        ],
      },
    ],
  },

  deletion: {
    title: 'Verilerimi sil',
    lead: 'Elimizde iki şey tutuluyor ve ikisini de sildirebilirsiniz.',
    sections: [
      {
        heading: '1. Oturum anahtarı — kendiniz silebilirsiniz',
        body: [
          'Panelden “Çıkış yap” demeniz yeterlidir. Bu işlem sunucudaki oturum kaydını siler; o anahtarla bir daha Instagram’a istek gönderilemez. Tarayıcınızdaki çerez de aynı anda temizlenir.',
        ],
      },
      {
        heading: '2. Takipçi listesi kopyası — talebiniz üzerine',
        body: [
          'Son analizinizdeki takipçi listenizin bir kopyasını, bir sonraki analizde “sizi kim bıraktı” sorusunu cevaplayabilmek için saklıyoruz. Silinmesini isterseniz Instagram kullanıcı adınızla birlikte bize e-posta gönderin; kaydı siler ve size dönüş yaparız.',
          'Bu durumda bir sonraki analizinizde geçmiş karşılaştırması sıfırdan başlar. Bu beklenen bir davranıştır, bir hata değildir.',
        ],
      },
      {
        heading: 'Instagram tarafında da sonlandırmak isterseniz',
        body: [
          'Instagram ayarlarındaki “Güvenlik → Oturum açılan cihazlar” bölümünden bizim oturumumuzu da sonlandırabilirsiniz. Bu, elimizdeki anahtarı anında kullanılamaz hâle getirir.',
        ],
      },
    ],
    contact: 'E-posta: omnaydin1453@gmail.com',
  },

  notFound: {
    title: 'Bu sayfa bulunamadı',
    body: 'Adres yanlış yazılmış ya da sayfa kaldırılmış olabilir.',
    home: 'Ana sayfaya dönün',
  },

  offline: {
    title: 'Bağlantı yok',
    body: 'Çevrimdışısınız. Bağlantı sağlandığında bu sayfayı yenileyin.',
  },
};

export default tr;
