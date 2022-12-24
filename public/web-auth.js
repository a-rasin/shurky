const bufferToBase64 = buffer => btoa(String.fromCharCode(...new Uint8Array(buffer)));
const base64ToBuffer = base64 => Uint8Array.from(atob(base64), c => c.charCodeAt(0));

const registerButton = document.querySelector('#register');
const authenticateButton = document.querySelector('#authenticate');
const advancedButton = document.querySelector('#authenticate-advanced');
const deleteButton = document.querySelector('#delete');
const loader = document.querySelector('#loader');
const loggedInAs = JSON.parse(localStorage.getItem('user'));

const removeCredential = async () => {
  const reply = await (await fetch(`/api/delete-credential`, {
    method: 'PUT',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include'
  })).json();
  loggedInAs.raw_id = reply.raw_id;
  loggedInAs.publicKey = reply.publicKey;
  localStorage.setItem('user', JSON.stringify(loggedInAs));
  deleteButton.style.display = 'none';
  authenticateButton.style.display = 'none';
  registerButton.style.display = 'block';
}


if(loggedInAs.raw_id) {
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

    // Set options
    credentialCreationOptions.challenge = new Uint8Array(credentialCreationOptions.challenge.data);
    credentialCreationOptions.user.id = new Uint8Array(credentialCreationOptions.user.id.data);
    credentialCreationOptions.user.name = loggedInAs.name;
    credentialCreationOptions.user.displayName = loggedInAs.name;
    credentialCreationOptions.authenticatorSelection = {};

    // Creates the popup in the browser
    const credential = await navigator.credentials.create({
      publicKey: credentialCreationOptions
    });

    const credentialId = bufferToBase64(credential.rawId);

    const data = {
      rawId: credentialId,
      response: {
        // Publickey and signature over the entire attestationObject with a
        // private key that is stored in the authenticator when it is
        // manufactured.
        attestationObject: bufferToBase64(credential.response.attestationObject),
        // data that was passed to credentials.create
        clientDataJSON: bufferToBase64(credential.response.clientDataJSON),
        id: credential.id,
        type: credential.type
      }
    };

    const reply = await (await fetch(`/api/register`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({credential: data}),
      credentials: 'include'
    })).json();

    if (reply.status !== 'ok') {
      throw Error(reply.status);
    }

    loggedInAs.raw_id = reply.raw_id;
    loggedInAs.publicKey = reply.publicKey;
    localStorage.setItem('user', JSON.stringify(loggedInAs));

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

    credentialRequestOptions.challenge = new Uint8Array(credentialRequestOptions.challenge.data);
    credentialRequestOptions.allowCredentials = [
      {
        id: base64ToBuffer(loggedInAs.raw_id),
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

advancedButton.addEventListener('click', async () => {
  advancedButton.disabled = true;
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

    credentialRequestOptions.challenge = new Uint8Array(credentialRequestOptions.challenge.data);
    // credentialRequestOptions.allowCredentials = [
    //   {
    //     id: base64ToBuffer(loggedInAs.raw_id),
    //     type: 'public-key',
    //     transports: [ "usb", "nfc", "ble", "hybrid", "internal" ]
    //   }
    // ];

    debugger;
    const credential = await navigator.credentials.get({
      publicKey: credentialRequestOptions
    });
    console.log('test')

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
    advancedButton.disabled = false;
    authenticateButton.disabled = false;
    deleteButton.disabled = false;
  }
});

deleteButton.addEventListener('click', removeCredential);
