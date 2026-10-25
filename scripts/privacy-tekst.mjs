// Tekst van de privacyverklaring. Basis: het document “Privacystatement uitgebreid” (versie 16/11/2020) van WESP vzw,
// met kleine tekstuele rechtzettingen, een nieuw onderdeel over deze website en de naam van de huidige toezichthouder.

export const PRIVACY_VERSIE = "25 oktober 2026";
export const PRIVACY_VORIGE = "16 november 2020";

// statistiek: { cf, pl } uit afwerking.mjs
export function privacyHtml({ statistiek, esc }) {
  const diensten = [statistiek.cf && "Cloudflare Web Analytics", statistiek.pl && "Plausible Analytics"].filter(Boolean);
  const stats = diensten.length ? `<p><strong>Statistieken.</strong> We meten het gebruik van de website met ${diensten.join(" en ")}. Volgens de aanbieder werkt die dienst zonder cookies en volgt ze je niet over andere websites heen. We gebruiken de cijfers (aantal bezoeken, bekeken pagina’s, herkomst, land, toestel en snelheid van de website) om de website te verbeteren, niet om individuele bezoekers te herkennen.</p>` : "";
  return `
<h2 id="inleiding">Inleiding</h2>
<p>WESP vzw hecht veel waarde aan de bescherming van uw persoonsgegevens en aan het respect voor uw privacy. In deze privacyverklaring willen we heldere en transparante informatie geven over welke gegevens we verzamelen en hoe wij omgaan met persoonsgegevens. Wij doen er alles aan om uw privacy te waarborgen en gaan daarom zorgvuldig om met persoonsgegevens.</p>
<p>WESP vzw houdt zich in alle gevallen aan de toepasselijke wet- en regelgeving, waaronder de Algemene Verordening Gegevensbescherming. Dit brengt met zich mee dat wij in ieder geval:</p>
<ul>
<li>uw persoonsgegevens verwerken in overeenstemming met het doel waarvoor deze zijn verstrekt; deze doelen en het type persoonsgegevens zijn beschreven in deze privacyverklaring;</li>
<li>de verwerking van uw persoonsgegevens beperken tot enkel die gegevens die minimaal nodig zijn voor de doeleinden waarvoor ze worden verwerkt;</li>
<li>vragen om uw uitdrukkelijke toestemming als wij deze nodig hebben voor de verwerking van uw persoonsgegevens;</li>
<li>passende technische en organisatorische maatregelen hebben genomen zodat de beveiliging van uw persoonsgegevens gewaarborgd is;</li>
<li>geen persoonsgegevens doorgeven aan andere partijen, tenzij dit nodig is voor de uitvoering van de doeleinden waarvoor ze zijn verstrekt;</li>
<li>op de hoogte zijn van uw rechten omtrent uw persoonsgegevens, u hierop willen wijzen en deze respecteren.</li>
</ul>

<h2 id="verantwoordelijke">Wie is verantwoordelijk?</h2>
<p>Als WESP vzw zijn wij verantwoordelijk voor de verwerking van uw persoonsgegevens. Heeft u na het doornemen van deze privacyverklaring, of in algemenere zin, vragen hierover of wenst u contact met ons op te nemen, dan kan dat via onderstaande contactgegevens:</p>
<p>WESP vzw, Jozef Wautersstraat 4, 3010 Kessel-Lo<br>Ondernemingsnummer BE 0863 441 738<br><a href="mailto:info@merodefestival.be">info@merodefestival.be</a><br>0498 75 82 96</p>

<h2 id="doelen">Waarom verwerken wij persoonsgegevens?</h2>
<p>Uw persoonsgegevens worden door WESP vzw verwerkt voor de volgende doeleinden en op basis van de volgende rechtsgronden:</p>
<ul>
<li>om te kunnen deelnemen aan de activiteiten van WESP vzw (uitvoering van een overeenkomst);</li>
<li>het versturen van nieuwsbrieven en uitnodigingen (toestemming van de betrokkene);</li>
<li>het bekomen van subsidiëring door de overheid (wettelijke verplichting).</li>
</ul>
<p>Voor de bovenstaande doelstellingen kunnen wij de volgende persoonsgegevens van u vragen en verwerken:</p>
<ul>
<li>persoonlijke identiteitsgegevens: naam, voornaam, adres, telefoonnummer, e-mail;</li>
<li>persoonlijke kenmerken: geslacht, geboortedatum, geboorteplaats, nationaliteit.</li>
</ul>
<p>We gebruiken de verzamelde gegevens alleen voor de doeleinden waarvoor we de gegevens hebben verkregen.</p>

<h2 id="derden">Verstrekking aan derden</h2>
<p>De gegevens die u aan ons geeft, kunnen wij aan derde partijen verstrekken indien dit noodzakelijk is voor de uitvoering van de hierboven beschreven doeleinden. Zo maken wij gebruik van een derde partij voor:</p>
<ul>
<li>het verzorgen van de internetomgeving (webhosting);</li>
<li>het verzorgen van IT-infrastructuur (onder meer IT-netwerk);</li>
<li>het verzorgen en verspreiden van nieuwsbrieven en uitnodigingen.</li>
</ul>
<p>Wij geven nooit persoonsgegevens door aan andere partijen waarmee we geen verwerkersovereenkomst hebben afgesloten. Met deze partijen (verwerkers) maken wij hierin uiteraard de nodige afspraken om de beveiliging van uw persoonsgegevens te waarborgen. Verder zullen wij de door u verstrekte gegevens niet aan derden doorgeven, tenzij dit wettelijk verplicht en toegestaan is. Een voorbeeld hiervan is dat de politie in het kader van een onderzoek (persoons)gegevens bij ons opvraagt. In een dergelijk geval dienen wij medewerking te verlenen en zijn wij verplicht deze gegevens af te geven. Tevens kunnen wij persoonsgegevens delen met derden indien u ons hier (schriftelijk) toestemming voor geeft. U heeft het recht deze toestemming te allen tijde in te trekken, zonder dat dit afbreuk doet aan de rechtmatigheid van de verwerking vóór de intrekking daarvan. Wij verstrekken geen persoonsgegevens aan partijen die gevestigd zijn buiten de EU.</p>

<h2 id="minderjarigen">Minderjarigen</h2>
<p>Wij verwerken enkel persoonsgegevens van minderjarigen (personen jonger dan 16 jaar) indien daarvoor schriftelijke toestemming is gegeven door de ouder of wettelijke vertegenwoordiger.</p>

<h2 id="website">Bezoek aan deze website</h2>
<p><strong>Cookies.</strong> Deze website plaatst zelf geen cookies en gebruikt geen advertentie- of volgcookies.</p>
<p><strong>Technische gegevens.</strong> Net als elke website verwerkt onze webhost technische gegevens van uw bezoek (zoals uw IP-adres, het tijdstip en de opgevraagde pagina) om de website te laten werken en te beveiligen. Wij gebruiken die gegevens niet om u te identificeren.</p>
<p><strong>Lettertypes.</strong> De lettertypes staan op onze eigen server. Er wordt geen verbinding met Google gemaakt om ze te laden.</p>
${stats}
<p><strong>Spelers en video’s van andere diensten.</strong> Op sommige pagina’s staan spelers van Spotify, SoundCloud, YouTube en Vimeo. Die worden pas geladen nadat u op de knop klikt. Pas dan maakt uw browser verbinding met die dienst, die uw IP-adres kan zien en eigen cookies kan plaatsen. Voor die verwerking geldt het privacybeleid van die dienst. De voorbeeldafbeeldingen bij video’s staan op onze eigen server.</p>
<p><strong>Links naar andere websites.</strong> Via onze website komt u ook op andere websites, zoals het ticketplatform, de nieuwsbriefdienst, formulieren en de websites van onze partners. Voor wat daar met uw gegevens gebeurt, zijn zij zelf verantwoordelijk.</p>

<h2 id="bewaartermijn">Bewaartermijn</h2>
<p>WESP vzw bewaart persoonsgegevens niet langer dan noodzakelijk voor het doel waarvoor deze zijn verstrekt, dan wel op grond van de wet is vereist. De gegevens worden niet langer dan vijf jaar bewaard.</p>

<h2 id="beveiliging">Beveiliging van de gegevens</h2>
<p>Wij hebben passende technische en organisatorische maatregelen genomen om uw persoonsgegevens te beschermen tegen onrechtmatige verwerking. Zo hebben we bijvoorbeeld de volgende maatregelen genomen:</p>
<ul>
<li>alle personen die namens WESP vzw van uw gegevens kennis kunnen nemen, zijn gehouden aan geheimhouding daarvan;</li>
<li>we hanteren een gebruikersnaam- en wachtwoordbeleid op al onze systemen;</li>
<li>we pseudonimiseren en versleutelen persoonsgegevens als daar aanleiding toe is;</li>
<li>wij maken back-ups van de persoonsgegevens om deze te kunnen herstellen bij fysieke of technische incidenten;</li>
<li>we testen en evalueren regelmatig onze maatregelen;</li>
<li>onze medewerkers zijn geïnformeerd over het belang van de bescherming van persoonsgegevens.</li>
</ul>

<h2 id="rechten">Uw rechten omtrent uw gegevens</h2>
<p>U heeft recht op inzage en recht op correctie of verwijdering van de persoonsgegevens die wij van u ontvangen hebben. Bovenaan deze privacyverklaring staat hoe u contact met ons kunt opnemen. Om misbruik te voorkomen kunnen wij u daarbij vragen om u adequaat te identificeren.</p>
<p>Ook heeft u het recht om de door u verstrekte gegevens door ons te laten overdragen aan uzelf of, in opdracht van u, rechtstreeks aan een andere partij. Wij kunnen u vragen om u te legitimeren voordat wij gehoor kunnen geven aan voornoemde verzoeken.</p>

<h2 id="klachten">Klachten</h2>
<p>Mocht u een klacht hebben over de verwerking van uw persoonsgegevens, dan vragen wij u hierover direct contact met ons op te nemen. U heeft altijd het recht een klacht in te dienen bij de Gegevensbeschermingsautoriteit, de toezichthoudende autoriteit op het gebied van privacybescherming (<a href="https://www.gegevensbeschermingsautoriteit.be" target="_blank" rel="noopener">gegevensbeschermingsautoriteit.be</a>).</p>

<h2 id="wijziging">Wijziging van deze privacyverklaring</h2>
<p>WESP vzw kan deze privacyverklaring wijzigen. Van een wijziging doen we een aankondiging op onze website. De laatste wijziging gebeurde op ${PRIVACY_VERSIE}. De vorige versie dateert van ${PRIVACY_VORIGE}.</p>
<p>Oudere versies van onze privacyverklaring worden in ons archief bewaard. Stuur ons een e-mail als u deze wilt raadplegen.</p>`;
}
