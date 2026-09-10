import { connect as connectTcp } from "node:net";
import { connect as connectTls, type TLSSocket } from "node:tls";
import type { Socket } from "node:net";
import { lookup } from "node:dns/promises";

type SmtpSocket = Socket | TLSSocket;

function readReply(socket: SmtpSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = "";

    function onData(chunk: Buffer): void {
      buffer += chunk.toString("utf8");
      const lines = buffer.replace(/\r\n/g, "\n").split("\n").filter(Boolean);
      const last = lines.at(-1);
      if (!last || last.length < 4 || last[3] === "-") {
        return;
      }

      cleanup();
      resolve(buffer.trim());
    }

    function onError(error: Error): void {
      cleanup();
      reject(error);
    }

    function cleanup(): void {
      socket.off("data", onData);
      socket.off("error", onError);
    }

    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function sendCommand(
  socket: SmtpSocket,
  command: string,
  expected: number,
): Promise<string> {
  socket.write(`${command}\r\n`);
  const reply = await readReply(socket);
  const code = Number(reply.slice(0, 3));
  if (code !== expected) {
    throw new Error(
      `SMTP ${command.split(" ")[0]} failed: ${reply.slice(0, 120)}`,
    );
  }
  return reply;
}

function connectPlain(host: string, port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connectTcp({ host, port, family: 4 });
    socket.once("connect", () => resolve(socket));
    socket.once("error", reject);
  });
}

async function connectImplicitTls(
  host: string,
  port: number,
): Promise<TLSSocket> {
  const { address } = await lookup(host, { family: 4 });

  return new Promise((resolve, reject) => {
    const socket = connectTls(
      {
        host: address,
        port,
        servername: host,
      },
      () => resolve(socket),
    );

    socket.once("error", reject);
  });
}

function upgradeTls(socket: Socket, host: string): Promise<TLSSocket> {
  return new Promise((resolve, reject) => {
    const tlsSocket = connectTls(
      { socket, host, servername: host },
      () => resolve(tlsSocket),
    );
    tlsSocket.once("error", reject);
  });
}

export async function sendMailViaSmtp(options: {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const password = options.password.replace(/\s+/g, "");
  let socket: SmtpSocket;

  if (options.port === 465) {
    socket = await connectImplicitTls(options.host, options.port);
  } else {
    const plain = await connectPlain(options.host, options.port);
    const greeting = await readReply(plain);
    if (!greeting.startsWith("220")) {
      plain.destroy();
      throw new Error("SMTP greeting failed");
    }
    await sendCommand(plain, "EHLO takatak.ca", 250);
    await sendCommand(plain, "STARTTLS", 220);
    socket = await upgradeTls(plain, options.host);
  }

  if (options.port === 465) {
    const greeting = await readReply(socket);
    if (!greeting.startsWith("220")) {
      socket.destroy();
      throw new Error("SMTP greeting failed");
    }
  }

  await sendCommand(socket, "EHLO takatak.ca", 250);
  await sendCommand(socket, "AUTH LOGIN", 334);
  await sendCommand(
    socket,
    Buffer.from(options.user, "utf8").toString("base64"),
    334,
  );
  await sendCommand(
    socket,
    Buffer.from(password, "utf8").toString("base64"),
    235,
  );
  await sendCommand(socket, `MAIL FROM:<${options.from}>`, 250);
  await sendCommand(socket, `RCPT TO:<${options.to}>`, 250);
  await sendCommand(socket, "DATA", 354);

  const body = options.text.replace(/\n/g, "\r\n").replace(/^\./gm, "..");
  const payload = [
    `From: Takatak Team <${options.from}>`,
    `To: ${options.to}`,
    `Subject: ${options.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
    ".",
  ].join("\r\n");

  socket.write(`${payload}\r\n`);
  const dataReply = await readReply(socket);
  if (!dataReply.startsWith("250")) {
    throw new Error(`SMTP DATA failed: ${dataReply.slice(0, 120)}`);
  }

  await sendCommand(socket, "QUIT", 221);
  socket.end();
}
