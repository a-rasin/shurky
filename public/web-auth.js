const bufferToBase64 = buffer => btoa(String.fromCharCode(...new Uint8Array(buffer)));
const base64ToBuffer = base64 => Uint8Array.from(atob(base64), c => c.charCodeAt(0));

const registerButton = document.querySelector('#register');
const authenticateButton = document.querySelector('#authenticate');
const deleteButton = document.querySelector('#delete');
const loader = document.querySelector('#loader');

const removeCredential = () => {
  localStorage.removeItem('credential');
  deleteButton.style.display = 'none';
  authenticateButton.style.display = 'none';
  registerButton.style.display = 'block';
}

const hasCredential = localStorage.getItem('credential') !== null;

if(hasCredential) {
  registerButton.style.display = 'none';
  authenticateButton.style.display = 'block';
  deleteButton.style.display = 'block';
}
else {
  registerButton.style.display = 'block';
}

registerButton.addEventListener('click', async () => {
  registerButton.disabled = true;
  loader.innerHTML = 'Loading...';
  loader.style.display = 'block';

  try {
    const credentialCreationOptions = await (await fetch(`/api/registration-options`, {
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    })).json();

    credentialCreationOptions.challenge = new Uint8Array(credentialCreationOptions.challenge.data);
    credentialCreationOptions.user.id = new Uint8Array(credentialCreationOptions.user.id.data);
    credentialCreationOptions.user.name = 'test@test.com';
    credentialCreationOptions.user.displayName = 'Test account';
    credentialCreationOptions.authenticatorSelection = {};

    const credential = await navigator.credentials.create({
      publicKey: credentialCreationOptions
    });

    const credentialId = bufferToBase64(credential.rawId);

    localStorage.setItem('credential', JSON.stringify({credentialId}));

    console.log(bufferToBase64(credential.response.attestationObject))
    const data = {
      rawId: credentialId,
      response: {
        attestationObject: bufferToBase64(credential.response.attestationObject),
        clientDataJSON: bufferToBase64(credential.response.clientDataJSON),
        id: credential.id,
        type: credential.type
      }
    };

    await (await fetch(`/api/register`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({credential: data}),
      credentials: 'include'
    })).json();

    registerButton.style.display = 'none';
    authenticateButton.style.display = 'block';
    deleteButton.style.display = 'block';

    loader.innerHTML = 'Registration successful!';

  } catch (err) {
    console.error('registration failed', err);

    loader.style.display = 'block';
    loader.innerHTML = 'Registration failed: ' + err;
  } finally {
    registerButton.disabled = false;
  }
})

authenticateButton.addEventListener('click', async () => {
  authenticateButton.disabled = true;
  deleteButton.disabled = true;
  loader.innerHTML = 'Loading...';
  loader.style.display = 'block';

  try {
    const credentialRequestOptions = await (await fetch(`/api/authentication-options`, {
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    })).json();

    const {credentialId} = JSON.parse(localStorage.getItem('credential'));

    credentialRequestOptions.challenge = new Uint8Array(credentialRequestOptions.challenge.data);
    credentialRequestOptions.allowCredentials = [
      {
        id: base64ToBuffer(credentialId),
        type: 'public-key',
        transports: [ "usb", "nfc", "ble", "hybrid", "internal" ]
      }
    ];

    const credential = await navigator.credentials.get({
      publicKey: credentialRequestOptions
    });

    const data = {
      rawId: bufferToBase64(credential.rawId),
      response: {
        authenticatorData: bufferToBase64(credential.response.authenticatorData),
        signature: bufferToBase64(credential.response.signature),
        userHandle: bufferToBase64(credential.response.userHandle),
        clientDataJSON: bufferToBase64(credential.response.clientDataJSON),
        id: credential.id,
        type: credential.type
      }
    };

    const response = (await fetch(`/api/authenticate`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({credential: data}),
      credentials: 'include'
    }));

    if(response.status === 401) {
      loader.innerHTML = 'Credential has expired, please register a new credential';

      removeCredential();
    } else {
      await response.json();

      loader.innerHTML = 'Authentication successful!';
    }
  } catch(e) {
    console.error('authentication failed', e);

    loader.style.display = 'block';
    loader.innerHTML = 'Authentication failed: ' + e;
  } finally {
    authenticateButton.disabled = false;
    deleteButton.disabled = false;
  }
});

deleteButton.addEventListener('click', removeCredential);
