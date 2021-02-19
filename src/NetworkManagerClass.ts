import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

import { Toast, ToastTypes } from '@huds0n/toast';
import { Core } from '@huds0n/core';
import Huds0nError from '@huds0n/error';
import {
  assignEnumerableGetters,
  makePromiseCancellable,
  useAsyncCallback,
  useMemo,
} from '@huds0n/utilities';

import { theming } from './theming';
import * as Types from './types';

export class NetworkManagerClass {
  theming = theming;

  static DEFAULT_NO_NETWORK_MESSAGE: ToastTypes.Message = {
    autoDismiss: false,
    backgroundColor: Core.colors.WARN,
    layout: 'relative',
    message: 'No Network Connection',
    messageStyle: { alignSelf: 'center' },
  };
  static DEFAULT_SUBMITTING_MESSAGE: ToastTypes.Message = {
    autoDismiss: false,
    dismissOnScreenPress: true,
  };
  static DEFAULT_ERROR_MESSAGE: ToastTypes.Message = {
    autoDismiss: false,
    backgroundColor: Core.colors.ERROR,
    disableScreenTouch: true,
    highPriority: true,
    icon: {
      name: 'error-outline',
      set: 'MaterialIcons',
    },
  };

  private _noNetworkId?: Symbol | string;
  private _noNetworkMessage = NetworkManagerClass.DEFAULT_NO_NETWORK_MESSAGE;
  private _ToastComponent: any;

  constructor({ noNetworkMessage, ToastComponent = Toast }: Types.Options) {
    this._ToastComponent = ToastComponent;

    noNetworkMessage && this.setNoNetworkMessage(noNetworkMessage);
    this._handleConnection();

    this.onConnection = this.onConnection.bind(this);
    this.setNoNetworkMessage = this.setNoNetworkMessage.bind(this);
    this.useIsConnected = this.useIsConnected.bind(this);

    this.useSubmit = this.useSubmit.bind(this);
  }

  get isConnected() {
    return Core.state.isConnected;
  }

  setNoNetworkMessage(message: ToastTypes.Message) {
    this._noNetworkMessage = assignEnumerableGetters(
      {},
      NetworkManagerClass.DEFAULT_NO_NETWORK_MESSAGE,
      message,
    );
  }

  private _handleConnection() {
    function handleIsConnected(state: NetInfoState) {
      Core.setState({ isConnected: state.isConnected });
    }

    NetInfo.fetch().then(handleIsConnected);
    NetInfo.addEventListener(handleIsConnected);

    Core.addListener('isConnected', ({ isConnected }) => {
      if (isConnected) {
        this._ToastComponent.hide(this._noNetworkId);
      } else {
        this._noNetworkId = this._ToastComponent.display(
          this._noNetworkMessage,
        );
      }
    });
  }

  onConnection(
    callback?: () => any,
    onError?: (e: Error) => any,
  ): { complete: Promise<boolean>; cancel: () => boolean } {
    let removeListener: () => boolean;

    const promise = new Promise<boolean>(async (resolve) => {
      if (this.isConnected) {
        if (callback) {
          await Promise.resolve(callback());
        }

        resolve(true);
      } else {
        removeListener = Core.addListener(
          'isConnected',
          async ({ isConnected }) => {
            if (isConnected) {
              removeListener();
              if (callback) {
                await Promise.resolve(callback());
              }
              resolve(true);
            }
          },
        );
      }
    });

    const { cancel, cancellablePromise } = makePromiseCancellable(promise);

    const complete = cancellablePromise.catch((error) => {
      removeListener?.();
      onError?.(error);
      return false;
    });

    return {
      cancel,
      complete,
    };
  }

  useIsConnected() {
    const [isConnected] = Core.useProp('isConnected');

    return isConnected;
  }

  useSubmit<A extends any[], T>(
    asyncCallback: (...args: A) => T | Promise<T>,
    dependencies: any[] = [],
    options: Types.SubmitOptions<T> = {},
  ): [((...args: A) => Promise<void>) | undefined, Types.SubmitStatus] {
    const {
      disabled,
      getErrorMessage,
      onError,
      onSuccess,
      submittingMessage,
    } = options;

    const isConnected = this.useIsConnected();

    const _runCallback = async (...args: A) => {
      Core.dismissInput();
      let submittingMessageId: string | symbol | undefined;

      if (submittingMessage) {
        submittingMessageId = this._ToastComponent.display(
          assignEnumerableGetters(
            {},
            NetworkManagerClass.DEFAULT_SUBMITTING_MESSAGE,
            submittingMessage,
          ),
        );
      }

      try {
        const result = await asyncCallback(...args);

        await Promise.resolve(onSuccess?.(result));

        if (submittingMessageId) {
          this._ToastComponent.hide(submittingMessageId);
        }
      } catch (error) {
        if (submittingMessageId) {
          this._ToastComponent.hide(submittingMessageId);
        }

        const formattedError = Huds0nError.transform(error, {
          name: 'NetworkManagerError',
          code: 'SUBMIT_ERROR',
          message: 'Unable to submit',
          info: { submitOptions: options },
          severity: 'HIGH',
          handled: true,
        });

        let errorMessageId: string | symbol | undefined;

        const cancel = () => {
          errorMessageId && this._ToastComponent.hide(errorMessageId);
          onError?.(formattedError);
        };

        if (getErrorMessage) {
          const tryAgain = () => {
            errorMessageId && this._ToastComponent.hide(errorMessageId);
            _runCallback(...args);
          };

          const errorMessage = getErrorMessage({ error, cancel, tryAgain });

          errorMessageId = this._ToastComponent.display(
            assignEnumerableGetters(
              {},
              NetworkManagerClass.DEFAULT_ERROR_MESSAGE,
              errorMessage,
            ),
          );
        } else {
          cancel();
        }
      }
    };

    const [run, running] = useAsyncCallback(_runCallback, dependencies);

    const available = isConnected && !running && !disabled;

    const submit = useMemo(() => (available ? run : undefined), [
      ...dependencies,
      available,
    ]);

    let status: Types.SubmitStatus = running
      ? 'SUBMITTING'
      : !isConnected
      ? 'NO_CONNECTION'
      : options?.disabled
      ? 'DISABLED'
      : 'AVAILABLE';

    return [submit, status];
  }
}
