<template>
  <q-page padding>
    <q-btn @click="connectBluetooth" label="Conectar Bluetooth" color="primary" icon="search" />
    <div v-if="device">
      <p>Dispositivo conectado: {{ device.name }}</p>
    </div>
    <div v-if="data">
      <p>Dados recebidos: {{ data }}</p>
    </div>
    <div v-if="error" class="error">
      <p>Erro: {{ error }}</p>
    </div>
  </q-page>
</template>

<script>
import md5 from 'md5';

export default {
  data() {
    return {
      device: null,
      data: null,
      error: null,
      gattServer: null,
      serviceUuid: '9094612c-729f-1fb1-224c-7c507d0a9853',
      characteristicUuid: '919a4685-0c1a-d092-584e-01b8c0b58766',
      macAddress: '78:05:41:34:87:08',
      key: 123456,
    };
  },
  methods: {
    async connectBluetooth() {
      this.clearErrors();
      try {
        if (this.gattServer && this.gattServer.connected) {
          this.disconnect();
        } else {
          await this.initiateConnection();
        }
      } catch (error) {
        this.handleError('Erro ao conectar ao Bluetooth', error);
      }
    },

    async initiateConnection() {
      console.log('Conectando...');
      const dispositivo = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [this.serviceUuid],
      });
      this.device = dispositivo;
      console.log('Nome dispositivo: ' + dispositivo.name);

      dispositivo.addEventListener('gattserverdisconnected', this.onDisconnected);

      this.gattServer = await dispositivo.gatt.connect();
      console.log('> Servidor GATT Encontrado');

      const driveService = await this.gattServer.getPrimaryService(this.serviceUuid);
      const characteristic = await driveService.getCharacteristic(this.characteristicUuid);

      if (!characteristic.properties.write) {
        throw new Error('A característica não permite escrita');
      }

      await this.authenticateDevice(characteristic);
    },

    async authenticateDevice(characteristic) {
      try {
        const token = this.calculateToken(this.macAddress, this.key);
        const command = this.buildAuthenticationCommand(token);
        await characteristic.writeValue(command);
        console.log('Comando de autenticação enviado');

        if (!characteristic.properties.read) {
          throw new Error('A característica não permite leitura');
        }

        const response = await characteristic.readValue();
        const result = new TextDecoder().decode(response);
        if (result.includes('01')) {
          console.log('Autenticação bem-sucedida');
          this.readData(characteristic);
        } else {
          throw new Error('Falha na autenticação');
        }
      } catch (error) {
        this.handleError('Erro na autenticação', error);
      }
    },

    async readData(characteristic) {
      try {
        const value = await characteristic.readValue();
        const result = new TextDecoder().decode(value);
        this.data = result;
        console.log(`Dados recebidos: ${this.data}`);
      } catch (error) {
        this.handleError('Erro ao ler dados', error);
      }
    },

    calculateToken(mac, key) {
      const lastThreeDigits = mac.split(':').slice(-3).join('');
      const token = md5(lastThreeDigits + key);
      return new Uint8Array(token.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    },

    buildAuthenticationCommand(token) {
      const header = new Uint8Array([0xEE]);
      const messageType = new Uint8Array([0x00]);
      const length = new Uint8Array([0x30]);
      const version = new Uint8Array([0x00]);
      const transactionId = new Uint8Array([0x00]);
      const commandId = new Uint8Array([0x00]);
      const totalNumber = new Uint8Array([0x00, 0x01]);
      const sequenceNumber = new Uint8Array([0x00, 0x01]);
      const crypto = new Uint8Array([0x00]);

      const dataKeyString = typeof this.key === 'string' ? this.key : this.key.toString(16).padStart(2, '0');
      const dataKey = new Uint8Array(dataKeyString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

      const countNumber = new Uint8Array([0x00]);
      const crc16 = this.calculateCRC16([...header, ...messageType, ...length, ...version, ...transactionId, ...commandId, ...totalNumber, ...sequenceNumber, ...crypto, ...dataKey, ...token, ...countNumber]);

      return new Uint8Array([...header, ...messageType, ...length, ...version, ...transactionId, ...commandId, ...totalNumber, ...sequenceNumber, ...crypto, ...dataKey, ...token, ...countNumber, ...crc16]);
    },

    calculateCRC16(data) {
      let crc = 0xFFFF;
      for (let byte of data) {
        crc ^= byte;
        for (let i = 0; i < 8; i++) {
          crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : crc >> 1;
        }
      }
      return new Uint8Array([(crc & 0xFF), (crc >> 8)]);
    },

    onDisconnected() {
      console.log('Dispositivo Bluetooth desconectado');
      this.device = null;
      this.gattServer = null;
    },

    disconnect() {
      if (this.gattServer) {
        this.gattServer.disconnect();
        console.log('Desconectado do dispositivo Bluetooth');
        this.device = null;
        this.gattServer = null;
      }
    },

    clearErrors() {
      this.error = null;
    },

    handleError(message, error) {
      console.error(`${message}:`, error);
      this.error = `${message}: ${error.message}`;
    },
  },
};
</script>

<style scoped>
.error {
  color: red;
}
</style>
