import { authFetch } from './utils.js';

const bufferToBase64 = buffer => btoa(String.fromCharCode(...new Uint8Array(buffer)));
const base64ToBuffer = base64 => Uint8Array.from(atob(base64), c => c.charCodeAt(0));

const user = document.querySelector('#user');
const registerButton = document.querySelector('#register');
// const authenticateButton = document.querySelector('#authenticate');
const advancedButton = document.querySelector('#authenticate-advanced');
const deleteButton = document.querySelector('#delete');
const logoutButton = document.querySelector('#logout');
const loader = document.querySelector('#loader');
let loggedInAs = JSON.parse(localStorage.getItem('user'));

const setVisibility = (loading) => {
  loggedInAs = JSON.parse(localStorage.getItem('user'));
  logoutButton.style.display = loggedInAs.name ? 'block' : 'none';
  registerButton.style.display = loggedInAs.name ? 'block' : 'none';
  deleteButton.style.display = loggedInAs.name && loggedInAs.raw_id ? 'block' : 'none';
  loader.style.display = loading ? 'block' : 'none';
  user.innerHTML = loggedInAs.name ? 'Logged in as: ' + loggedInAs.name : 'Not logged in';
}

setVisibility(false);

logoutButton.addEventListener('click', async () => {
  await authFetch(`/api/logout`, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include'
  })

  localStorage.setItem('user', '{}');
  loader.innerHTML = 'Logout successful';
  setVisibility(true);
})

const removeCredential = async () => {
  const reply = await (await authFetch(`/api/delete-credential`, {
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
  loader.innerHTML = 'Deletion successful';
  setVisibility(true);
}

registerButton.addEventListener('click', async () => {
  registerButton.disabled = true;
  loader.innerHTML = 'Loading...';
  setVisibility(true);

  try {
    const credentialCreationOptions = await (await authFetch(`/api/registration-options`, {
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

    const reply = await (await authFetch(`/api/register`, {
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

    setVisibility(true);

    loader.innerHTML = 'Registration successful!';

  } catch (err) {
    console.error('registration failed', err);

    setVisibility(true);
    loader.innerHTML = 'Registration failed: ' + err;
  } finally {
    registerButton.disabled = false;
  }
})

// authenticateButton.addEventListener('click', async () => {
//   authenticateButton.disabled = true;
//   deleteButton.disabled = true;
//   loader.innerHTML = 'Loading...';
//   loader.style.display = 'block';

//   try {
//     const credentialRequestOptions = await (await fetch(`/api/authentication-options`, {
//       mode: 'cors',
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       credentials: 'include'
//     })).json();

//     console.log('rawid', Uint8Array.from(loggedInAs.raw_id))
//     credentialRequestOptions.challenge = new Uint8Array(credentialRequestOptions.challenge.data);
//     credentialRequestOptions.allowCredentials = [
//       {
//         id: Uint8Array.from(loggedInAs.raw_id),
//         type: 'public-key',
//         transports: []
//       }
//     ];

//     const credential = await navigator.credentials.get({
//       publicKey: credentialRequestOptions
//     });

//     const data = {
//       rawId: bufferToBase64(credential.rawId),
//       response: {
//         authenticatorData: bufferToBase64(credential.response.authenticatorData),
//         signature: bufferToBase64(credential.response.signature),
//         userHandle: bufferToBase64(credential.response.userHandle),
//         clientDataJSON: bufferToBase64(credential.response.clientDataJSON),
//         id: credential.id,
//         type: credential.type
//       }
//     };

//     const response = (await fetch(`/api/authenticate`, {
//       method: 'POST',
//       mode: 'cors',
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify({credential: data}),
//       credentials: 'include'
//     }));
//       console.log(response)

//     if (response.status === 401) {
//       loader.innerHTML = 'Credential has expired, please register a new credential';

//       removeCredential();
//     } else if (response.status !== 200) {
//       throw response.statusText;
//     } else {
//       await response.json();

//       loader.innerHTML = 'Authentication successful!';
//     }
//   } catch(e) {
//     console.error('authentication failed', e);

//     loader.style.display = 'block';
//     loader.innerHTML = 'Authentication failed: ' + e;
//   } finally {
//     authenticateButton.disabled = false;
//     deleteButton.disabled = false;
//   }
// });

advancedButton.addEventListener('click', async () => {
  advancedButton.disabled = true;
  // authenticateButton.disabled = true;
  deleteButton.disabled = true;
  loader.innerHTML = 'Loading...';
  setVisibility(true);

  try {
    const credentialRequestOptions = await (await fetch(`/api/authentication-options`, {
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    })).json();

    credentialRequestOptions.challenge = new Uint8Array(credentialRequestOptions.challenge.data);

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

    const response = (await fetch(`/api/authenticate-advanced`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({credential: data}),
      credentials: 'include'
    }));

    if(response.status === 401) {
      throw (await response.json()).message;
    } else {
      const json = await response.json();
      localStorage.setItem('user', JSON.stringify(json));
      user.innerHTML = "Logged in as: " + json.name;
      loader.innerHTML = 'Authentication successful!';
    }
    setVisibility(true);
  } catch(e) {
    console.error('authentication failed', e);

    setVisibility(true);
    loader.innerHTML = 'Authentication failed: ' + e;
  } finally {
    advancedButton.disabled = false;
    // authenticateButton.disabled = false;
    deleteButton.disabled = false;
  }
});

deleteButton.addEventListener('click', removeCredential);
