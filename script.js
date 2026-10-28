const xhr = new XMLHttpRequest();
xhr.open("GET", "dati_covid.json", true);
xhr.responseType = "json";
xhr.onload = function() {
    if (xhr.status === 200) {
        const dati = xhr.response;
        const corpo = document.getElementById("corpoTabella");

        for (let i = 0; i < dati.length; i++) {
            const riga = document.createElement("tr");

            riga.innerHTML = '
                <td>${dati[i].data}</td>
                <td>${dati[i].stato}</td>
                <td>${dati[i].ricoverati_con_sintomi ?? ""}</td>
                <td>${dati[i].terapia_intensiva ?? ""}</td>
                <td>${dati[i].totale_ospedalizzati ?? ""}</td>
                <td>${dati[i].nuovi_positivi ?? ""}</td>
                <td>${dati[i].dimessi_guariti ?? ""}</td>
                <td>${dati[i].deceduti ?? ""}</td>
                <td>${dati[i].totale_casi ?? ""}</td>
            ';

            corpo.appendChild(riga);
        }
    } else {
        console.error("Errore nel caricamento dei dati. Codice HTTP:", xhr.status);
    }
};

xhr.onerror = function() {
    console.error("Errore di rete durante la richiesta XMLHttpRequest.");
};
xhr.send();

