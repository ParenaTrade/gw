import { createHash, createSign, generateKeyPairSync, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL, isoCBOR } from "@simplewebauthn/server/helpers";
import { identifySchema, signupOptionsSchema } from "@/lib/validation/schemas";
import { pgErrorInfo } from "@/lib/auth/signup";

/**
 * Yazılımsal authenticator: tarayıcı/cihaz davranışını taklit eder.
 * Amaç: sunucunun `options.challenge` değerini saklayıp doğrulamada aynısını
 * beklediğini (kayıt + giriş) ve UV zorunluluğunu kanıtlamak.
 */
const rpID = "kuponum.test";
const origin = "https://kuponum.test";

function sha256(data: Buffer | string) {
  return createHash("sha256").update(data).digest();
}

function makeAuthenticator() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = publicKey.export({ format: "jwk" }) as { x: string; y: string };
  const credentialId = randomBytes(32);
  const cose = Buffer.from(
    isoCBOR.encode(
      new Map<number, number | Uint8Array>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, Buffer.from(jwk.x, "base64url")],
        [-3, Buffer.from(jwk.y, "base64url")],
      ])
    )
  );

  const counterBuf = (n: number) => {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(n);
    return b;
  };

  return {
    credentialId: isoBase64URL.fromBuffer(credentialId),
    register(challenge: string, flags = 0x45) {
      const idLen = Buffer.alloc(2);
      idLen.writeUInt16BE(credentialId.length);
      const authData = Buffer.concat([
        sha256(rpID),
        Buffer.from([flags]),
        counterBuf(0),
        Buffer.alloc(16),
        idLen,
        credentialId,
        cose,
      ]);
      const clientDataJSON = Buffer.from(JSON.stringify({ type: "webauthn.create", challenge, origin }));
      const attestationObject = Buffer.from(
        isoCBOR.encode(
          new Map<string, unknown>([["fmt", "none"], ["attStmt", new Map()], ["authData", authData]]) as unknown as Parameters<
            typeof isoCBOR.encode
          >[0]
        )
      );
      return {
        id: isoBase64URL.fromBuffer(credentialId),
        rawId: isoBase64URL.fromBuffer(credentialId),
        type: "public-key" as const,
        clientExtensionResults: {},
        response: {
          clientDataJSON: isoBase64URL.fromBuffer(clientDataJSON),
          attestationObject: isoBase64URL.fromBuffer(attestationObject),
          transports: ["internal" as const],
        },
      };
    },
    authenticate(challenge: string, counter: number, flags = 0x05) {
      const authData = Buffer.concat([sha256(rpID), Buffer.from([flags]), counterBuf(counter)]);
      const clientDataJSON = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge, origin }));
      const signer = createSign("SHA256");
      signer.update(Buffer.concat([authData, sha256(clientDataJSON)]));
      return {
        id: isoBase64URL.fromBuffer(credentialId),
        rawId: isoBase64URL.fromBuffer(credentialId),
        type: "public-key" as const,
        clientExtensionResults: {},
        response: {
          clientDataJSON: isoBase64URL.fromBuffer(clientDataJSON),
          authenticatorData: isoBase64URL.fromBuffer(authData),
          signature: isoBase64URL.fromBuffer(signer.sign(privateKey)),
        },
      };
    },
  };
}

describe("passkey kayıt + giriş (yazılımsal authenticator)", () => {
  it("options.challenge saklanıp doğrulamada kullanılınca kayıt ve giriş başarılı olur", async () => {
    const device = makeAuthenticator();

    // — KAYIT: sunucu options.challenge'ı saklar (createChallenge davranışı)
    const regOptions = await generateRegistrationOptions({
      rpName: "KUponum",
      rpID,
      userName: "+905551112233",
      userDisplayName: "Test Kullanıcı",
      attestationType: "none",
      authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
    });
    const storedRegChallenge = regOptions.challenge;

    const reg = await verifyRegistrationResponse({
      response: device.register(regOptions.challenge),
      expectedChallenge: storedRegChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    expect(reg.verified).toBe(true);
    const cred = reg.registrationInfo!.credential;
    expect(cred.id).toBe(device.credentialId);

    // — GİRİŞ: DB'den okunan public key (base64url) ile doğrulama
    const storedPublicKey = Buffer.from(cred.publicKey).toString("base64url");
    const authOptions = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
      allowCredentials: [{ id: cred.id }],
    });
    const auth = await verifyAuthenticationResponse({
      response: device.authenticate(authOptions.challenge, 1),
      expectedChallenge: authOptions.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: cred.id,
        publicKey: new Uint8Array(Buffer.from(storedPublicKey, "base64url")),
        counter: cred.counter,
      },
      requireUserVerification: true,
    });
    expect(auth.verified).toBe(true);
    expect(auth.authenticationInfo.newCounter).toBe(1);
  });

  it("eski hata: rastgele (options'tan bağımsız) challenge saklanırsa doğrulama reddedilir", async () => {
    const device = makeAuthenticator();
    const regOptions = await generateRegistrationOptions({ rpName: "KUponum", rpID, userName: "+905551112233" });
    await expect(
      verifyRegistrationResponse({
        response: device.register(regOptions.challenge),
        expectedChallenge: randomBytes(32).toString("base64url"),
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      })
    ).rejects.toThrow(/challenge/i);
  });

  it("biyometrik/PIN doğrulaması (UV) olmayan passkey reddedilir", async () => {
    const device = makeAuthenticator();
    const regOptions = await generateRegistrationOptions({ rpName: "KUponum", rpID, userName: "+905551112233" });
    await expect(
      verifyRegistrationResponse({
        response: device.register(regOptions.challenge, 0x41), // UP + AT, UV yok
        expectedChallenge: regOptions.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      })
    ).rejects.toThrow();
  });

  it("farklı origin'den gelen yanıt reddedilir", async () => {
    const device = makeAuthenticator();
    const regOptions = await generateRegistrationOptions({ rpName: "KUponum", rpID, userName: "+905551112233" });
    await expect(
      verifyRegistrationResponse({
        response: device.register(regOptions.challenge),
        expectedChallenge: regOptions.challenge,
        expectedOrigin: "https://evil.example",
        expectedRPID: rpID,
        requireUserVerification: true,
      })
    ).rejects.toThrow();
  });
});

describe("kayıt akışı girişleri", () => {
  it("identify telefonu normalize eder", () => {
    expect(identifySchema.parse({ phone: "0555 111 22 33" }).phone).toBe("+905551112233");
    expect(() => identifySchema.parse({ phone: "12" })).toThrow();
  });

  it("signup ad soyad zorunlu ve en az 3 karakter", () => {
    expect(signupOptionsSchema.parse({ phone: "5551112233", fullName: "  Ali Veli " }).fullName).toBe("Ali Veli");
    expect(() => signupOptionsSchema.parse({ phone: "5551112233", fullName: "Al" })).toThrow();
    expect(() => signupOptionsSchema.parse({ phone: "5551112233" })).toThrow();
  });

  it("pgErrorInfo drizzle'ın sardığı pg hatasını (cause) çözer", () => {
    expect(pgErrorInfo({ code: "23505", constraint: "members_member_code_unique" })).toEqual({
      code: "23505",
      constraint: "members_member_code_unique",
    });
    expect(pgErrorInfo({ message: "Failed query", cause: { code: "23505", constraint: "auth_identities_phone_unique" } })).toEqual({
      code: "23505",
      constraint: "auth_identities_phone_unique",
    });
    expect(pgErrorInfo(new Error("x"))).toEqual({});
    expect(pgErrorInfo(null)).toEqual({});
  });
});
