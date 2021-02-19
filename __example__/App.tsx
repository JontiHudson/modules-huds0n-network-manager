import React from 'react';
import { SafeAreaView, StyleSheet, Text } from 'react-native';

import { Button } from '@huds0n/components';
import { Core } from '@huds0n/core';
import { createNetworkManager } from '@huds0n/network-manager';
import { Toast } from '@huds0n/toast';
import { timeout, useRef } from '@huds0n/utilities';

export default function NetworkManagerPlayground() {
  const [submit, status] = NetworkManager.useSubmit(
    async () => {
      return await mockDataFetch();
    },
    [],
    {
      getErrorMessage: ({ tryAgain, cancel }) => ({
        title: 'Error Fetching Data',
        actions: [
          { label: 'Try Again', onPress: tryAgain },
          { label: 'Cancel', onPress: cancel },
        ],
      }),
      submittingMessage: {
        title: 'Fetching Mock Data',
        message: 'This may take a few moments',
        icon: {
          name: 'database',
          set: 'Entypo',
        },
      },
      onError: (e) => console.log({ e }),
      onSuccess: (v) => console.log({ v }),
    },
  );

  const toggleConnection = () =>
    Core.setState({ isConnected: !Core.state.isConnected });

  const onConnectionFn = () => {
    console.log('Has connected!');
  };

  const cancelRunOnConnection = useRef(() => {});

  const runOnConnection = () => {
    const { cancel } = NetworkManager.onConnection(onConnectionFn, console.log);

    cancelRunOnConnection.current = () => console.log(cancel());
  };

  return (
    <Toast>
      <SafeAreaView style={styles.safeAreaView}>
        <Button spinner={status === 'SUBMITTING'} onPress={submit}>
          Refresh Data
        </Button>
        <Text>{`Submit Status is ${status}`}</Text>
        <Button onPress={toggleConnection}>Toggle Network Connection</Button>
        <Button onPress={runOnConnection}>Run On Connection</Button>
        <Button onPress={() => cancelRunOnConnection.current()}>
          Cancel Run On Connection
        </Button>
      </SafeAreaView>
    </Toast>
  );
}

const colors = {
  BLUE: 'lightblue',
  GREEN: 'green',
  GREY: 'grey',
  WARN: 'orange',
  WHITE: 'white',
};

const styles = StyleSheet.create({
  safeAreaView: {
    alignItems: 'center',
    flex: 1,
  },
});

async function mockDataFetch() {
  await timeout(2500);
  if (!NetworkManager.isConnected) {
    throw Error('Unable to fetch');
  }
  return 'Fetched';
}

const NetworkManager = createNetworkManager({
  noNetworkMessage: {
    backgroundColor: colors.WARN,
  },
});
