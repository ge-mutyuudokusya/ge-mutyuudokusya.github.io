
 //音量スライダー
 function changeVolume() {
  var volume = parseFloat(document.getElementById("volumeControl").value);
  wavesurfer.setVolume(volume);
}
//おまじない
    var wavesurfer = WaveSurfer.create({
      container: "#waveform",
      waveColor: "#FF9A9E",
      progressColor: "#FAD0C4",
      backend: 'WebAudio'
    });
    var audioContext = null;
    var currentRegion = null;
    var regionInfoDiv = document.getElementById("region-info");
    var downloadLinkDiv = document.getElementById("download-link");
    var loopActive = false;
    function initAudioContext() {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
    }
    wavesurfer.on("ready", function () {
      wavesurfer.enableDragSelection({ drag: true });
      initAudioContext();
    });
    wavesurfer.on("region-created", function (region) {
      if (currentRegion) currentRegion.remove();
      currentRegion = region;
      region.color = "rgba(0, 0, 255, 0.28)"; // 青色に変更
      updateRegionInfo(region);
    });
    wavesurfer.on("region-click", function (region, e) {
      e.stopPropagation();
      wavesurfer.play(region.start, region.end);
    });
    //ループアラート
    function toggleLoop() {
      if (currentRegion) {
        loopActive = !loopActive;
        currentRegion.loop = loopActive;
        alert(loopActive ? "ループ再生を有効化" : "ループ再生を無効化");
      } else {
        alert("ループするリージョンがありません。");
      }
    }

    //範囲選択と抽出
    function updateRegionInfo(region) {
      regionInfoDiv.innerHTML = `
        <p>選択範囲情報:</p>
        <ul>
          <li>開始地点: ${region.start.toFixed(2)} 秒</li>
          <li>終了地点: ${region.end.toFixed(2)} 秒</li>
          <li>長さ: ${(region.end - region.start).toFixed(2)} 秒</li>
        </ul>
        <button onclick="exportAudio()" class="btn btn-info">抽出</button>
      `;
    }
    function resetRegions() {
      wavesurfer.clearRegions();
      currentRegion = null;
      regionInfoDiv.innerHTML = "";
      downloadLinkDiv.innerHTML = "";
    }
    function changePlaybackRate() {
      var speed = parseFloat(document.getElementById("speedControl").value);
      wavesurfer.setPlaybackRate(speed);
    }
    document.getElementById("fileUpload").addEventListener("change", function (e) {
      var file = e.target.files[0];
      if (file) {
        var objectURL = URL.createObjectURL(file);
        wavesurfer.load(objectURL);
        resetRegions();
      }
    });
//問題が起きた時の
async function exportAudio() {
  if (!currentRegion) {
    alert("エクスポートするリージョンがありません。");
    return;
  }
  try {
    initAudioContext();
    const buffer = wavesurfer.backend.buffer;
    if (!buffer) {
      alert("オーディオバッファが利用できません。");
      return;
    }
    const start = currentRegion.start;
    const end = currentRegion.end;
    const regionDuration = end - start;
    const sampleRate = buffer.sampleRate;
    const startSample = Math.floor(start * sampleRate);
    const endSample = Math.floor(end * sampleRate);
    const numberOfChannels = buffer.numberOfChannels;
    const newBuffer = audioContext.createBuffer(
      numberOfChannels,
      endSample - startSample,
      sampleRate
    );
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const originalData = buffer.getChannelData(channel);
      const newData = newBuffer.getChannelData(channel);
      for (let i = 0; i < newData.length; i++) {
        newData[i] = originalData[startSample + i];
      }
    }

    // 選択されたフォーマットを取得
    const selectedFormat = document.getElementById("formatSelect").value;
    let exportedBlob;
    
    if (selectedFormat === "ogg") {
      exportedBlob = await bufferToWaveBlob(newBuffer);
    } else {
      alert("RPGツクールで使う場合はoggファイルしか使えないよ");
      exportedBlob = await bufferToWaveBlob(newBuffer);
    }

    const url = URL.createObjectURL(exportedBlob);
    downloadLinkDiv.innerHTML = `
//ダウンロード
      <a href="${url}" download="exported_region.${selectedFormat}" class="btn btn-info">
        <i class="glyphicon glyphicon-download"></i> ダウンロード (${selectedFormat.toUpperCase()})
      </a>
    `;

  } catch (error) {
    console.error("エクスポートエラー:", error);
    alert("エクスポートエラー: " + error.message);
  }
}
//おまじない
function bufferToWaveBlob(buffer) {
      return new Promise((resolve) => {
        const numberOfChannels = buffer.numberOfChannels;
        const length = buffer.length * numberOfChannels * 2 + 44;
        const arrayBuffer = new ArrayBuffer(length);
        const view = new DataView(arrayBuffer);
        let pos = 0;
        writeString("RIFF");
        view.setUint32(pos, length - 8, true); pos += 4;
        writeString("WAVE");
        writeString("fmt ");
        view.setUint32(pos, 16, true); pos += 4;
        view.setUint16(pos, 1, true); pos += 2;
        view.setUint16(pos, numberOfChannels, true); pos += 2;
        view.setUint32(pos, buffer.sampleRate, true); pos += 4;
        view.setUint32(pos, buffer.sampleRate * 2 * numberOfChannels, true); pos += 4;
        view.setUint16(pos, numberOfChannels * 2, true); pos += 2;
        view.setUint16(pos, 16, true); pos += 2;
        writeString("data");
        view.setUint32(pos, length - pos - 4, true); pos += 4;
        const channels = [];
        for (let i = 0; i < numberOfChannels; i++) {
          channels.push(buffer.getChannelData(i));
        }
        let offset = 0;
        while (pos < length) {
          for (let i = 0; i < numberOfChannels; i++) {
            let sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = (0.5 + sample * 32767) | 0;
            view.setInt16(pos, sample, true);
            pos += 2;
          }
          offset++;
        }
        function writeString(string) {
          for (let i = 0; i < string.length; i++) {
            view.setUint8(pos + i, string.charCodeAt(i));
          }
          pos += string.length;
        }
        resolve(new Blob([arrayBuffer], { type: "audio/wav" }));
      });
    }
