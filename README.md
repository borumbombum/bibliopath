# Bibliopath

Bibliopath is a Nostr powered tool and a platform for Open reading & Open publishing.

For more info about the spirit of this project, please visit the [about page](https://bibliopath.vercel.app/p/about).
<br />
We help authors publish **Books for the Open Web** and readers have control over their reading.

## Current ToDos

- epubs:
  - epub books are different type than offline books, when they should not (they are converted to text books and stored on IndexDB).
  - When converted to text the chapters are not created as we expect in the reader.
- Create a model book with audio capabilities as showcase.
- Better homepage hero and menus, with config switcher (also on homepage).
- Create a http proxy on our Futurewise API to handle the fetch, rate limiting, etc and substitute this <https://api.allorigins.win/raw?url=https://www.gutenberg.org/files/11/11-0.txt>
- Create a store for theme state, use it in all routes.
- Once a book is downloaded offer to save it in indexDB and bookmark it.
- Search should change the query parameter.
- Implement Nostr Login: https://github.com/nostrband/nostr-login (in the future we will need a more complex setup, so people with no Nostr know-how can signup and have a better onboarding).
- Allow for github/nostrgit books written in markdown
  - Create a selection of curated books, with audio books.
- Disclaimer (only Creative Commons work)
- Info button to get book and author data.
- Centralize types at src/lib & componentize the thing.
- Add translation functionalities for paragraphs in books via AI.
- Multi-lingual support via paraglidejs.
- Shortcuts: CMD + K, etc.
- Footer: Add version & better github link.
- Add favicons (considering the PWA).
- Book downloading progress bar.
- Make Bibliopath an open-repository hosted at the Futurewise org.
- Create e-pub support (and consider moving from txt Gutemberg format to this, for better indexes and metadata).
- Pre-render authors at the hompage.
- Add more Nostr capabilities.
  - An author should be able to upload his own books (which will be hosted at Nostr).
  - Authors with no Nostr account it should be created on the fly.
- Add changelog from git commits.
- AI: Enable read a chapter using something like ElevenLabs (paid).
- Create a DockerFile + docker-compose so people can easily create instances.

## Bugs

- Bug: Change theme is not working anymore (drak mode). Even when it is correctly stored.
- Bug: Fix the changeTheme function mess.
- Bug: Previous scroll position is remembered when reading a book, but it user switches from landscape to portrait then, position is messes up. Have a converter?
- Bug: On mobile pagination should be "Prev - Next" with the input switcher also.
- Bug: No error message when downloading fails... no retry button.

- Local sync between PWAs

```
Excellent and very specific question. You want to bypass the public internet and use local network capabilities like Wi-Fi or Bluetooth for communication between two PWAs.

This is a very advanced use case for web technologies. The short answer is: direct, automatic discovery and data exchange over local Wi-Fi or Bluetooth is highly restricted and generally not possible in the way a native app can do it.

However, there is a very effective and widely-used workaround that achieves your goal of keeping the data transfer local after a brief initial setup.

Let's break down the "why" and then the "how."

The Challenge: Browser Sandboxing
Browsers are designed with a strict security model called a "sandbox." This model prevents a web page from having unfettered access to your device's hardware and network information.

Local Wi-Fi Discovery: A PWA cannot scan the local 192.168.x.x network to find other devices. It doesn't have access to network discovery protocols like mDNS or UPnP that native apps use. It simply doesn't know the local IP addresses of other phones on the same Wi-Fi.

Peer-to-Peer Bluetooth: While there is a Web Bluetooth API, it is designed for a browser to act as a "central" device connecting to simpler "peripheral" devices (like a heart-rate monitor, smart lightbulb, or printer). It is not designed for two browsers to discover each other and form a general-purpose data link. One browser cannot easily act as a discoverable Bluetooth "peripheral" for the other to find.

The Solution: WebRTC over Local Wi-Fi (with a Handshake)
This is the best and most practical solution available today (as of August 2025). It cleverly uses standard web technologies to achieve local data transfer.

The core idea is that while the browsers can't discover each other locally, if they are introduced to each other, they are smart enough to realize they're on the same Wi-Fi and can talk directly.

Here’s the step-by-step process:

Step 1: The Introduction (The "Handshake")
Since they can't auto-discover, you need a manual way for one device to find the other. The most elegant way is with a QR Code.

Device A (Host):

The PWA on Device A connects to a very simple, public signaling server (using WebSockets).

The server creates a unique "room" or "session" for Device A.

Device A's PWA then generates a QR Code containing the unique link or ID for this session. It displays this QR code on the screen.

Device B (Client):

The user on Device B opens the PWA.

Using the getUserMedia() API to access the camera, the PWA acts as a QR code scanner.

The user scans the QR code shown on Device A.

Step 2: The Signaling
After scanning, Device B now has the unique session ID.

Device B also connects to the same public signaling server and says, "I want to join the session from the QR code."

The signaling server now sees both Device A and Device B in the same "room" and can help them exchange the necessary WebRTC connection information (this is the ICE process we discussed previously).

Step 3: The Local Magic (WebRTC Connection)
This is the crucial part that meets your requirement.

During the WebRTC handshake (ICE process), the browsers exchange all possible network paths they can use to connect. This includes:

Their public IP address (via the internet).

Their local network IP address (e.g., 192.168.1.5).

WebRTC is smart. It will test all paths and see that the fastest, lowest-latency route is the direct one between their local IP addresses.

It establishes the RTCPeerConnection directly over the local Wi-Fi.

The Result:

The signaling server is only used for a few seconds for the initial introduction. All of your actual application data (messages, files, etc.) sent through the RTCDataChannel will travel directly between the devices over the local Wi-Fi, never touching the public internet. This is fast, private, and uses no internet bandwidth for the data exchange itself.

What about other technologies?
Web NFC API: The Web NFC API allows a PWA to read and write to NFC tags. You could use this instead of a QR code for the handshake—Device A writes the session URL to a tag, and Device B taps it. This is very slick but requires devices with NFC chips and is less universally supported than cameras.

Wi-Fi Aware & Wi-Fi Direct: These are true P2P Wi-Fi technologies. However, there are no Web APIs that give a PWA access to them. This remains in the domain of native applications.

Bottom Line
To exchange information locally between two browsers on different devices:

You cannot rely on automatic discovery like native apps do.

Your best and most reliable solution is WebRTC.

You must implement a "handshake" mechanism, like a QR code scan, to introduce the two devices.

This method requires a brief, initial internet connection to a signaling server, but all subsequent PWA data is exchanged directly over the local Wi-Fi network.
```

- Book Download Progress Bar:

```javascript
<progress id="progress" value="0" max="100"></progress>
<pre id="output"></pre>

<script>
async function downloadWithProgress(url) {
 const response = await fetch(url);
 const contentLength = response.headers.get('Content-Length');

 if (!response.ok) throw new Error('Network error');
 if (!contentLength) console.warn('No content length — progress may be inaccurate');

 const total = parseInt(contentLength, 10) || 0;
 const reader = response.body.getReader();
 const decoder = new TextDecoder();
 let received = 0;
 let result = '';

 while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  received += value.length;
  result += decoder.decode(value, { stream: true });

  // Update progress bar
  if (total) {
   document.getElementById('progress').value = (received / total) * 100;
  }
 }

 // Final decode
 result += decoder.decode();
 document.getElementById('output').textContent = result;
}

downloadWithProgress('https://raw.githubusercontent.com/sindresorhus/awesome/main/readme.md');
</script>
🧠 Notes
Content-Length header is essential for accurate progress; if the server doesn’t provide it, you can still show indeterminate progress (e.g. spinner).

Works for any streamable text, including .txt, .md, .csv, etc.

If you want to download and save the file with progress, use [Streams API + File System API] or blobs + URL.createObjectURL.
```

##

If you're seeing this, you've probably already done this step. Congrats!

```bash
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
