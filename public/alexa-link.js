(() => {
  const FIREBASE_API_KEY = 'AIzaSyC8qZo1lOfFs95s0e7U3igThAn5U2cmGTM';
  const OAUTH_CLIENT_ID = 'babysteps-alexa';
  const params = new URLSearchParams(window.location.search);
  const form = document.getElementById('link-form');
  const linkButton = document.getElementById('link-button');
  const denyButton = document.getElementById('deny-button');
  const errorNotice = document.getElementById('request-error');

  const request = {
    response_type: params.get('response_type') || '',
    client_id: params.get('client_id') || '',
    redirect_uri: params.get('redirect_uri') || '',
    state: params.get('state') || '',
    scope: params.get('scope') || '',
    code_challenge: params.get('code_challenge') || '',
    code_challenge_method: params.get('code_challenge_method') || '',
  };

  const showError = message => {
    errorNotice.textContent = message;
    errorNotice.hidden = false;
  };

  const validRequest = (
    request.response_type === 'code'
    && request.client_id === OAUTH_CLIENT_ID
    && request.redirect_uri
    && request.state
    && request.code_challenge
    && request.code_challenge_method === 'S256'
  );

  if (!validRequest) {
    form.hidden = true;
    showError(
      'This Alexa account-linking request is incomplete or invalid. Return to the Alexa app and try again.',
    );
    return;
  }

  denyButton.addEventListener('click', () => {
    const destination = new URL(request.redirect_uri);
    destination.searchParams.set('error', 'access_denied');
    destination.searchParams.set('state', request.state);
    window.location.assign(destination.toString());
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    errorNotice.hidden = true;
    linkButton.disabled = true;
    denyButton.disabled = true;
    linkButton.textContent = 'Linking…';

    try {
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const signInResponse = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            returnSecureToken: true,
          }),
        },
      );
      const signIn = await signInResponse.json();

      if (!signInResponse.ok || !signIn.idToken) {
        throw new Error('The email or password is incorrect.');
      }

      const authorizeResponse = await fetch('/alexa/oauth/authorize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${signIn.idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      const authorization = await authorizeResponse.json();

      if (!authorizeResponse.ok || !authorization.redirectUrl) {
        throw new Error(
          authorization.message
          || 'PitterPatter could not link Alexa. Please try again.',
        );
      }

      window.location.assign(authorization.redirectUrl);
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : 'PitterPatter could not link Alexa. Please try again.',
      );
      linkButton.disabled = false;
      denyButton.disabled = false;
      linkButton.textContent = 'Link Alexa';
    }
  });
})();
