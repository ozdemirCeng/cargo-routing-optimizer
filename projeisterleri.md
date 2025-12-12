Kocael˙I Un¨ ˙Ivers˙Ites˙I B˙Ilg˙Isayar Muhend ¨ ˙Isl˙Ig˘˙I
Yazılım Lab.I
2025-2026 Guz, Proje III ¨
Kargo ˙
I¸sletme Sistemi
Proje Ba¸slangı¸c Tarihi . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 10 Aralık 2025
Proje Biti¸s Tarihi . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 28 Aralık 2025
1 Projenin ˙I¸ceri˘gi
Kocaeli’nin il¸celerinden Kocaeli Universitesi’ne gelen kargo ara¸cları i¸cin y¨uk ve rota plan- ¨
laması yapmanız istenmektedir. Kullanıcılardan talep alınarak i¸sletilen bu sistemde kullanıcılar i¸cin dinamik olarak rota planlamaları yapılacaktır. Belirli ara¸c ve kargo istasyonu
bilgilerinin, kargo istasyonundaki kargo sayısı ve a˘gırlıkları bilgisi ile birle¸stirilerek en optimum rotaların olu¸sturulması hedeflenmektedir. Bunu yaparken ara¸cların kiralama maliyeti
ve yakıt t¨uketiminin de hesaplanarak kapasite-maliyet optimizasyonunun da yapılması beklenmektedir.
Web uygulamada y¨onetici ve kullanıcı paneli bulunmalıdır. ˙Iki panelin de sizler tarafından
geli¸stirilmesi gerekmektedir.
Kullanıcı panelinde kargo g¨onderimi yapacak ki¸sinin istasyon se¸cebilmesi gerekir. Tanımlı
olmayan bilgilerin giri¸sine izin verilmemelidir.
Y¨onetici paneli aracılı˘gıyla yeni istasyon bilgisi eklenebilmelidir.
Y¨onetici panelinde rota planması yapılmalıdır. Rota planlaması yaparken bir sonraki g¨un
istasyondaki kargo sayısı, a˘gırlıkları toplamı ve istasyon bilgileri kullanılmalıdır.
Rota planlaması yapıldıktan sonra kullanıcılara kargo ta¸sıyacak olan aracın g¨uzergah bilgileri g¨osterilmelidir. Farklı ara¸cların g¨uzergah bilgilerine eri¸simi engellenmelidir.
T¨um ara¸cların rota bilgileri admin panelinde harita ¨ust¨unde g¨or¨unt¨ulenmelidir. G¨uzergah
1
yol ¸cizdirme algoritması olarak planlanmalıdır. ˙Iki nokta arasındaki ku¸s u¸cu¸su ¸cizim kabul
edilmeyecektir. Ayrıca hazır uygulamaların (google harita, yandex vs.) g¨uzergah
¸cizimleri kabul de˘gildir.
Y¨onetici her bir ara¸c i¸cin olu¸sturulan rotaların maliyetlerini, toplam maliyetleri, her ara¸c
i¸cin olu¸sturulan rotaları ve her ara¸c i¸cerisindeki kargoya sahip kullanıcıları g¨or¨unt¨uleyebilmelidir. Ek olarak y¨onetici b¨ut¨un olası senaryolar i¸cin ¨ozet tablo/grafik olu¸sturabilmelidir.
Kocaeli’deki il¸ce merkezlerinin konumları istasyon konumu olarak ele alınmalıdır. Bu bilgiler (latitude, longitude) internetten bulunabilir. Uygulama i¸cinde istasyon bilgisi harita
¨ust¨unde g¨osterilmelidir. Yeni istasyon eklendi˘ginde harita ¨ust¨unde g¨uncelleme yapılmalıdır.
Kocaeli’nin il¸celeri:
• Ba¸siskele, C¸ ayırova, Darıca, Derince, Dilovası, Gebze, G¨olc¨uk, Kandıra, Karam¨ursel,
Kartepe, K¨orfez, ˙Izmit
Uygulama ger¸cekle¸stirildikten sonra tekrardan yeni senaryolar i¸cin ¸calı¸stırılabilmelidir. Ayrıca
veritabanına t¨um seferler anlık olarak kaydedilip g¨or¨unt¨ulenebilmelidir.
2 Problemler
Sınırsız sayıda ara¸c problemi:
Minimum maliyetle ka¸c ara¸c ile ta¸sıma i¸slemleri tamamlanabilir?
•
˙Istasyonlar arası mesafeler ve ara¸cların ortalama yakıt t¨uketimi bilinmektedir. Ara¸cların
sayısı yeterli gelmedi˘ginde veya yol maliyeti ara¸c kiralama maliyetini ge¸cti˘ginde belirli
sayıda ara¸c sistem tarafından kiralanabilmektedir.
Belirli sayıda kargo aracı:
Minimum maliyet maksimum kargo ile ara¸cların g¨uzergahları nasıl olmalıdır?
Minimum maliyet maksimum kargo ile hangi kargolar kabul edilmelidir? Maksimum kargo
iki farklı durum olarak ele alınmalıdır. Birisi toplam kargo sayısının en y¨uksek olması di˘geri
ise maksimum sayıda kargo olmasıdır.
3 Notlar
Yol maliyeti km ba¸sına 1 birim olarak kabul edilmelidir.
Ba¸slangı¸cta 3 kargo aracı bulunmaktadır. Bu ara¸cların kiralama maliyeti yoktur.
Kargo ara¸clarının kargo kapasiteleri sırasıyla 500, 750, 1000 kg’dir.
Ara¸c kiralama maliyeti 200 birimdir (500 kg kapasiteli).
2
Parametreler de˘gi¸stirilebilmelidir.
Proje Dili: Proje web uygulama olarak geli¸stirilmelidir. Web programlama dillerinden
herhangi birini kullanabilirsiniz.
4 Ornek Senaryolar ¨
A¸sa˘gıda belirtilen senaryolar ¨ornek olarak verilmi¸stir. Sunum sırasında farklı senaryolar
istenebilir. Ayrıca hangi senaryo istenirse istensin belirli sayıda kargo aracı problemi
ile sınırsız sayıda kargo aracı problemi i¸cin de ¸c¨oz¨um sa˘glanmalıdır.
Senaryo 1
˙Il¸ce Kargo Sayısı A˘gırlık (kg)
Ba¸siskele 10 120
C¸ ayırova 8 80
Darıca 15 200
Derince 10 150
Dilovası 12 180
Gebze 5 70
G¨olc¨uk 7 90
Kandıra 6 60
Karam¨ursel 9 110
Kartepe 11 130
K¨orfez 6 75
˙Izmit 14 160
Senaryo 2
˙Il¸ce Kargo Sayısı A˘gırlık (kg)
Ba¸siskele 40 200
C¸ ayırova 35 175
Darıca 10 150
Derince 5 100
Dilovası 0 0
Gebze 8 120
G¨olc¨uk 0 0
Kandıra 0 0
Karam¨ursel 0 0
Kartepe 0 0
K¨orfez 0 0
˙Izmit 20 160
Senaryo 3
˙Il¸ce Kargo Sayısı A˘gırlık (kg)
Ba¸siskele 0 0
C¸ ayırova 3 700
Darıca 0 0
Derince 0 0
Dilovası 4 800
Gebze 5 900
G¨olc¨uk 0 0
Kandıra 0 0
Karam¨ursel 0 0
Kartepe 0 0
K¨orfez 0 0
˙Izmit 5 300
Senaryo 4
˙Il¸ce Kargo Sayısı A˘gırlık (kg)
Ba¸siskele 30 300
C¸ ayırova 0 0
Darıca 0 0
Derince 0 0
Dilovası 0 0
Gebze 0 0
G¨olc¨uk 15 220
Kandıra 5 250
Karam¨ursel 20 180
Kartepe 10 200
K¨orfez 8 400
˙Izmit 0 0
Senaryo 1’de toplam kargo a˘gırlı˘gı 1445 kg ve toplam kargo adedi 113’t¨ur. Mevcut
ara¸cların toplam kapasitesi 2250 kg oldu˘gu i¸cin sınırsız ara¸c probleminde herhangi bir ek
3
ara¸c kiralamaya gerek yoktur. Ancak bazı durumlarda kargoların il¸celere g¨ore da˘gılımı rota
maliyetlerini artırabilece˘ginden, a˘gırlık ve mesafeye g¨ore ara¸c y¨ukleme planı yapılmalıdır.
Ara¸clara hangi il¸celerin atanaca˘gı, yakıt maliyeti ve toplam ta¸sıma maliyetini en aza indirecek ¸sekilde belirlenmelidir.
Belirli sayıda ara¸c problemindeProjede yapılacak ¸c¨oz¨umlerin t¨um alternatiflerin
denenerek yapılması kabul edilmeyecektir (brute-force). Sezgisel yakla¸sımlarından
birinin kullanılması beklenmektedir.
5 Ornek Senaryolar ¨
A¸sa˘gıda belirtilen senaryolar ¨ornek olarak verilmi¸stir. Sunum sırasında farklı
senaryolar istenebilir. Ayrıca hangi senaryo istenirse istensin belirli sayıda
kargo aracı problemi ile sınırsız sayıda kargo aracı problemi i¸cin de ¸c¨oz¨um
sa˘glanmalıdır.
Senaryo 1
˙Il¸ce Kargo Sayısı A˘gırlık (kg)
Ba¸siskele 10 120
C¸ ayırova 8 80
Darıca 15 200
Derince 10 150
Dilovası 12 180
Gebze 5 70
G¨olc¨uk 7 90
Kandıra 6 60
Karam¨ursel 9 110
Kartepe 11 130
K¨orfez 6 75
˙Izmit 14 160
Senaryo 2
˙Il¸ce Kargo Sayısı A˘gırlık (kg)
Ba¸siskele 40 200
C¸ ayırova 35 175
Darıca 10 150
Derince 5 100
Dilovası 0 0
Gebze 8 120
G¨olc¨uk 0 0
Kandıra 0 0
Karam¨ursel 0 0
Kartepe 0 0
K¨orfez 0 0
˙Izmit 20 160
Senaryo 3
˙Il¸ce Kargo Sayısı A˘gırlık (kg)
Ba¸siskele 0 0
C¸ ayırova 3 700
Darıca 0 0
Derince 0 0
Dilovası 4 800
Gebze 5 900
G¨olc¨uk 0 0
Kandıra 0 0
Karam¨ursel 0 0
Kartepe 0 0
K¨orfez 0 0
˙Izmit 5 300
Senaryo 4
˙Il¸ce Kargo Sayısı A˘gırlık (kg)
Ba¸siskele 30 300
C¸ ayırova 0 0
Darıca 0 0
Derince 0 0
Dilovası 0 0
Gebze 0 0
G¨olc¨uk 15 220
Kandıra 5 250
Karam¨ursel 20 180
Kartepe 10 200
K¨orfez 8 400
˙Izmit 0 0
4
Senaryo 1’de toplam kargo a˘gırlı˘gı 1445 kg ve toplam kargo adedi 113’t¨ur.
Mevcut ara¸cların toplam kapasitesi 2250 kg oldu˘gu i¸cin sınırsız ara¸c probleminde
herhangi bir ek ara¸c kiralamaya gerek yoktur. Ancak bazı durumlarda kargoların il¸celere g¨ore da˘gılımı rota maliyetlerini artırabilece˘ginden, a˘gırlık ve mesafeye g¨ore ara¸c y¨ukleme planı yapılmalıdır. Ara¸clara hangi il¸celerin atanaca˘gı,
yakıt maliyeti ve toplam ta¸sıma maliyetini en aza indirecek ¸sekilde belirlenmelidir.
Belirli sayıda ara¸c probleminde kapasite sorunu olmadı˘gından t¨um kargolar
kabul edilebilir. Fakat ama¸c sadece kapasiteyi doldurmak de˘gil, toplam rota
maliyetini minimize etmektir. Bu nedenle her bir aracın alaca˘gı kargolar, il¸celer
arası mesafeler ve toplam a˘gırlık g¨oz ¨on¨unde bulundurularak optimize edilmelidir. Kullanıcılara, kargolarının hangi ara¸cla ta¸sındı˘gı ve planlanan rotanın
harita ¨uzerinde g¨osterimi sa˘glanmalıdır. Ayrıca t¨um ara¸cların rotaları, y¨onetici
panelinde harita ¨uzerinde g¨or¨unt¨ulenebilmelidir.
Senaryo 2’de toplam kargo a˘gırlı˘gı 905 kg ve kargo adedi 118’dir. Bu de˘gerler
mevcut ara¸c kapasitesinin altında oldu˘gundan belirli sayıda ara¸c probleminde
t¨um kargolar ta¸sınabilir. Ancak il¸celere g¨ore kargo yo˘gunlu˘gunun dengesiz olması nedeniyle rota optimizasyonu kritik hale gelmektedir. Karam¨ursel, Derince
ve Darıca gibi il¸celerden kargo alınmaması durumunda bazı ara¸cların ¸cok uzun
mesafe kat ederek tek bir kargo grubu ta¸sıması gerekebilir. Bu nedenle kargo
kabul¨u yapılırken hem toplam kargo sayısı hem de toplam a˘gırlık i¸cin optimum
karar verilmelidir. Rota planlaması yapılırken en kısa yol, kapasite kullanım
oranı ve ara¸c ba¸sına d¨u¸sen toplam maliyet hesaplanmalıdır.
Senaryo 3’te toplam kargo a˘gırlı˘gı 2700 kg olup mevcut kapasite olan 2250
kg’nın ¨uzerindedir. Bu nedenle sınırsız ara¸c probleminde en az bir aracın
kiralanması zorunludur. A˘gırlı˘gın b¨uy¨uk kısmı birka¸c il¸cede yo˘gunla¸smı¸stır
(Gebze, Dilovası, C¸ ayırova). Bu nedenle ek ara¸c kullanımının gereklili˘gi sadece
kapasite a¸cısından de˘gil, aynı zamanda rota maliyetlerini d¨u¸s¨urmek a¸cısından
da ¨onemlidir. Ara¸clar, il¸celere g¨ore a˘gırlık ve mesafe da˘gılımı dikkate alınarak
ayrılmalı ve y¨uk minimum maliyetli ¸sekilde payla¸stırılmalıdır.
Senaryo 4’te toplam kargo a˘gırlı˘gı 1150 kg ve kargo sayısı 88’dir. Bu durumda mevcut 3 ara¸cla sefer d¨uzenlenebilir; ancak bazı il¸celerin di˘gerlerine g¨ore
¸cok daha uzak veya maliyetli olması halinde 1 ara¸c ile mi yoksa 2 ara¸c ile mi
ta¸sımanın daha ekonomik olaca˘gı hesaplanmalıdır. Bu senaryoda ama¸c t¨um
kargoları ta¸sımak olsa bile rota maliyeti g¨oz ¨on¨unde bulundurularak ara¸c sayısı
optimize edilmelidir. Yani kapasite yeterli olsa bile tek ara¸c kullanmak maliyeti
artırabilir. Bu nedenle hangi il¸celerin hangi araca atanaca˘gı, toplam mesafeyi
ve maliyeti minimize edecek ¸sekilde belirlenmelidir.
