import type { DriveStep } from 'driver.js'

/**
 * Some fields render extra content below the input once the user starts
 * typing (password strength meter, confirm-password mismatch hint). Targeting
 * the input+hint wrapper (via data-tour-target, see the field's JSX) instead
 * of the bare input keeps that content lit by the tour's spotlight instead of
 * sitting in the dimmed overlay — without pulling the field's own label in.
 */
function tourTarget(key: string) {
  return () => document.querySelector(`[data-tour-target="${key}"]`) as Element
}

export function getLoginPasswordTourSteps(): DriveStep[] {
  return [
    {
      element: '#login-card-header',
      popover: {
        title: 'Sign in with email & password',
        description: 'Here\'s a quick guide to signing in. Click "Next" to continue, or close this anytime.',
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '#email',
      popover: {
        title: 'Email',
        description: 'Enter the work email you registered with, e.g. you@company.com.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '#password',
      popover: {
        title: 'Password',
        description: 'Enter your account password. Click the eye icon to show or hide it.',
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '#login-submit',
      popover: {
        title: 'Sign in',
        description: 'Once your email and password are filled in, click this button to access your workspace.',
        side: 'top',
        align: 'center',
      },
    },
  ]
}

export function getLoginPasskeyTourSteps(): DriveStep[] {
  return [
    {
      element: '#login-passkey',
      popover: {
        title: 'Sign in with a passkey',
        description: 'Already registered a passkey (fingerprint/Face ID)? Click this button to sign in without typing a password.',
        side: 'top',
        align: 'center',
      },
    },
  ]
}

export function getLoginMicrosoftTourSteps(): DriveStep[] {
  return [
    {
      element: '#login-social',
      popover: {
        title: 'Sign in with Microsoft',
        description: 'Click this button to sign in instantly using your work Microsoft account — no password needed.',
        side: 'top',
        align: 'center',
      },
    },
  ]
}

export function getRegisterPasswordTourSteps(): DriveStep[] {
  return [
    {
      element: '#register-card-header',
      popover: {
        title: 'Create an account with email & password',
        description: 'Follow these steps to register a new account. Click "Next" to continue, or close this anytime.',
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '#register-email',
      popover: {
        title: 'Email',
        description: 'Enter your work email. This will be your login identity.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '#register-name',
      popover: {
        title: 'Display name (optional)',
        description: 'Filled in automatically from your email, but you can change it to whatever you like.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: tourTarget('register-password-input'),
      popover: {
        title: 'Password',
        description: 'Create a strong password. A strength indicator will appear below this field.',
        side: 'top',
        align: 'start',
      },
    },
    {
      element: tourTarget('register-confirm-input'),
      popover: {
        title: 'Confirm password',
        description: 'Re-type the same password to make sure there are no typos.',
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '#register-submit',
      popover: {
        title: 'Sign up',
        description: 'Once all fields are valid, click this button to create your account.',
        side: 'top',
        align: 'center',
      },
    },
  ]
}

export function getRegisterMicrosoftTourSteps(): DriveStep[] {
  return [
    {
      element: '#register-social',
      popover: {
        title: 'Sign up with Microsoft',
        description: 'Click this button to create your account instantly using your work Microsoft account — no new password needed.',
        side: 'top',
        align: 'center',
      },
    },
  ]
}
