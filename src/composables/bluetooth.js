import { ref } from 'vue';

export function useBluetooth() {
  const connected = ref(false);
  const deviceName = ref('');

  // ... (outras funções)

async function connect() {
  // 1. Solicitar ao usuário a permissão para usar o Bluetooth
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true, // Ou especifique filtros para dispositivos específicos
    optionalServices: [/*UUID do serviço desejado*/]
  });

  // 2. Conectar ao dispositivo
  const server = await device.gatt.connect();

  // 3. Obter a característica para comunicação (UUID)
  const characteristic = await server.getPrimaryService(/*UUID do serviço*/)
    .then(service => service.getCharacteristic(/*UUID da característica*/));

  // 4. Configurar a função de envio
  send = (data) => characteristic.writeValue(new Uint8Array([data]));

  // 5. Configurar a função de recebimento
  characteristic.addEventListener('characteristicvaluechanged', (event) => {
    const data = event.target.value.getUint8Array(0, event.target.value.byteLength);
    receive.value.emit('message', String.fromCharCode(...data));
  });

  // 6. Atualizar o estado da conexão
  connected.value = true;
  deviceName.value = device.name;
}

// ... (outras funções)

  return {
    connect,
    disconnect,
    send,
    receive,
    connected,
    deviceName
  };
}
