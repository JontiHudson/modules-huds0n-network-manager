import Huds0nError from '@huds0n/error';
import { ToastTypes } from '@huds0n/toast';

export type SubmitOptions<T> = {
  disabled?: boolean;
  getErrorMessage?: (options: SubmitErrorOptions) => ToastTypes.Message;
  onError?: (error: Huds0nError) => any;
  onSuccess?: (result: T) => any;
  submittingMessage?: ToastTypes.Message;
};

export type SubmitErrorOptions = {
  error: Huds0nError;
  cancel: () => void;
  tryAgain: () => void;
};

export type SubmitStatus =
  | 'SUBMITTING'
  | 'NO_CONNECTION'
  | 'DISABLED'
  | 'AVAILABLE';
