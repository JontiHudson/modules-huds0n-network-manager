import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

import Huds0nError from "@huds0n/error";
import { Toast, ToastTypes } from "@huds0n/toast";
import { theme } from "@huds0n/theming/src/theme";
import {
  assignEnumerableGetters,
  useAsyncCallback,
  useMemo,
} from "@huds0n/utilities";
import { huds0nState } from "@huds0n/utilities/src/_core";

import type { Types } from "./types";

export class NetworkManagerClass {
  static DEFAULT_NO_NETWORK_MESSAGE: ToastTypes.Message<any> = {
    autoDismiss: false,
    get backgroundColor() {
      return theme.colors.WARN;
    },
    zIndex: 1,
    layout: "relative",
    message: "No Network Connection",
    messageStyle: { alignSelf: "center" },
  };
  static DEFAULT_SUBMITTING_MESSAGE: ToastTypes.Message<any> = {
    autoDismiss: false,
    dismissOnScreenPress: true,
  };
  static DEFAULT_ERROR_MESSAGE: ToastTypes.Message<any> = {
    autoDismiss: false,
    get backgroundColor() {
      return theme.colors.ERROR;
    },
    disableScreenTouch: true,
    zIndex: 3,
    icon: {
      name: "error-outline",
      set: "MaterialIcons",
    },
  };

  private _noNetworkId = Symbol("noNetworkMessageId");
  private _noNetworkMessage: ToastTypes.Message<any> =
    NetworkManagerClass.DEFAULT_NO_NETWORK_MESSAGE;
  private _ToastComponent = Toast;

  constructor() {
    this._handleConnection();

    this.onConnectionAsync = this.onConnectionAsync.bind(this);
    this.setNoNetworkMessage = this.setNoNetworkMessage.bind(this);
    this.useIsConnected = this.useIsConnected.bind(this);

    this.useSubmit = this.useSubmit.bind(this);
  }

  get isConnected() {
    return huds0nState.state.isNetworkConnected;
  }

  setNoNetworkMessage(message: ToastTypes.Message) {
    this._noNetworkMessage = assignEnumerableGetters(
      {},
      NetworkManagerClass.DEFAULT_NO_NETWORK_MESSAGE,
      message
    );
  }

  private _handleConnection() {
    const handleIsConnected = (state: NetInfoState) => {
      if (state.isConnected) {
        this._ToastComponent.hide(this._noNetworkId);
      } else {
        // @ts-ignore
        this._ToastComponent.display({
          ...this._noNetworkMessage,
          _id: this._noNetworkId,
        });
      }

      huds0nState.setState({ isNetworkConnected: state.isConnected || false });
    };

    NetInfo.fetch().then(handleIsConnected);
    NetInfo.addEventListener(handleIsConnected);
  }

  onConnectionAsync(timeout?: number) {
    return new Promise<boolean>(async (resolve) => {
      if (this.isConnected) {
        resolve(true);
      } else {
        const removeListener = huds0nState.addListener(
          async ({ isNetworkConnected }) => {
            if (isNetworkConnected) {
              removeListener();
              resolve(true);
            }
          },
          "isNetworkConnected"
        );

        if (typeof timeout === "number") {
          setTimeout(() => {
            removeListener();
            resolve(false);
          }, timeout);
        }
      }
    });
  }

  useIsConnected() {
    return huds0nState.useProp("isNetworkConnected")[0];
  }

  useSubmit<A extends any[], T>(
    asyncCallback: (...args: A) => T | Promise<T>,
    dependencies: any[] = [],
    options: Types.SubmitOptions<T> = {}
  ): [((...args: A) => Promise<void>) | undefined, Types.SubmitStatus] {
    const { disabled, getErrorMessage, onError, onSuccess, submittingMessage } =
      options;

    const isConnected = this.useIsConnected();

    const _runCallback = async (...args: A) => {
      huds0nState.state.dismissInput();
      let submittingMessageId: ToastTypes.MessageId | undefined;

      if (submittingMessage) {
        submittingMessageId = this._ToastComponent.display(
          assignEnumerableGetters(
            {},
            NetworkManagerClass.DEFAULT_SUBMITTING_MESSAGE,
            submittingMessage
          )
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
          name: "NetworkManagerError",
          code: "SUBMIT_ERROR",
          message: "Unable to submit",
          info: { submitOptions: options },
          severity: "HIGH",
          handled: true,
        });

        let errorMessageId: ToastTypes.MessageId | undefined;

        const cancel = () => {
          errorMessageId && this._ToastComponent.hide(errorMessageId);
          onError?.(formattedError);
        };

        if (getErrorMessage) {
          const tryAgain = () => {
            errorMessageId && this._ToastComponent.hide(errorMessageId);
            _runCallback(...args);
          };

          const errorMessage = getErrorMessage({
            error: formattedError,
            cancel,
            tryAgain,
          });

          errorMessageId = this._ToastComponent.display(
            assignEnumerableGetters(
              {},
              NetworkManagerClass.DEFAULT_ERROR_MESSAGE,
              errorMessage
            )
          );
        } else {
          cancel();
        }
      }
    };

    const [run, running] = useAsyncCallback(_runCallback, dependencies);

    const available = isConnected && !running && !disabled;

    const submit = useMemo(
      () => (available ? run : undefined),
      [...dependencies, available]
    );

    let status: Types.SubmitStatus = running
      ? "SUBMITTING"
      : !isConnected
      ? "NO_CONNECTION"
      : options?.disabled
      ? "DISABLED"
      : "AVAILABLE";

    return [submit, status];
  }
}
