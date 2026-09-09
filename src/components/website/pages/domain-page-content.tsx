"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { BsClipboard } from "react-icons/bs";
import { RiShieldUserLine } from "react-icons/ri";
import { IoMdCheckmark } from "react-icons/io";
import { LiaHandHoldingUsdSolid } from "react-icons/lia";
import { AiOutlineGlobal } from "react-icons/ai";
import {
  ChevronDown,
  ChevronUp,
  Route,
  Repeat,
  Send,
  BookCopy,
} from "lucide-react";

import { openLiveChat } from "@/lib/website/chat-provider";
import styles from "./domain-page.module.css";

const everysip: { icon: ReactNode; title: string; details: string }[] = [
  {
    icon: <BsClipboard />,
    title: "Instant registration",
    details:
      "Secure the domain you’ve always wanted without delay — register it instantly with AI‑guided setup.",
  },
  {
    icon: <RiShieldUserLine />,
    title: "Free WHOIS privacy protection",
    details:
      "Privacy is important — that’s why we include full WHOIS protection and proactive security checks with every domain.",
  },
  {
    icon: <Route />,
    title: "Free web forwarding",
    details:
      "Redirect traffic from your domain to a preferred website, making navigation and accessibility easier than ever.",
  },
  {
    icon: <Repeat />,
    title: "Simple transfers (policy)",
    details:
      "Transfers are straightforward: CA$100 to transfer in. Generate your auth codes in our control panel. Transfers‑out available after 12 months.",
  },
  {
    icon: <Send />,
    title: "Unlimited email forwarding",
    details:
      "Redirect unlimited emails to chosen addresses — forwarding only (no inbox hosting) — so you stay connected with efficient communication.",
  },
  {
    icon: <LiaHandHoldingUsdSolid />,
    title: "Flat‑rate domain renewal",
    details:
      "Predictable pricing at CA$19.99/mo across terms. We cover domain, transaction, and admin costs — without sacrificing quality.",
  },
  {
    icon: <AiOutlineGlobal />,
    title: "Anycast DNS & 99.9% uptime",
    details:
      "Global Anycast DNS and resilient infrastructure deliver fast lookups and reliable resolution — built for speed and stability.",
  },
  {
    icon: <BookCopy />,
    title: "Easy contact management",
    details:
      "Enjoy hassle‑free contact management — make changes, do trades or transfers, or update contact details in bulk with ease.",
  },
];

const orderUp = [
  {
    icon: "/img/Freetransfer.svg",
    title: "Transparent domain pricing",
    details:
      "Enjoy world-class service at a flat CA$19.99/mo — our pricing is transparent so you can make informed decisions without hidden fees or surprises.",
  },
  {
    icon: "/img/Notification.svg",
    title: "Smart domain alerts",
    details:
      "Never miss critical updates again! Our AI-driven dashboard and tailored alerts keep you up-to-date with every aspect of your domain management.",
  },
  {
    icon: "/img/transfer.svg",
    title: "Always in your control",
    details:
      "All domains are registered in your name and fully belong to you, giving you complete authority to edit, transfer, or sell when you decide.",
  },
  {
    icon: "/img/management.svg",
    title: "Effortless management",
    details:
      "Our intuitive tools make managing your domain simple, secure, and efficient — keeping your online presence fully under your control.",
  },
  {
    icon: "/img/domains.svg",
    title: "Multiple domain support",
    details:
      "Add as many domains as you need to grow your business — TAKATAK scales with you, without performance limits.",
  },
  {
    icon: "/img/support.svg",
    title: "24/7 expert assistance",
    details:
      "Contact us anytime — our dedicated AI-backed support team is committed to your success and ready to solve any challenge.",
  },
];

const customers = [
  {
    star: "/img/stars.svg",
    title: "Prompt solutions",
    message:
      "The support team at TAKATAK has always been prompt, and most of the time the solution is quick and thorough. Some issues were technical, some billing-related, and some domain-specific. Last time, I was referred to a senior AI-assisted tech specialist who resolved my mail service problem instantly. Thank you!",
    name: "Marcus D",
  },
  {
    star: "/img/stars.svg",
    title: "Top-notch support and customer service",
    message:
      "We moved our existing domains from another host to TAKATAK. During the transfer, a few domains had issues, but TAKATAK’s team resolved them quickly so we could resume business without delays. Their AI+human support is top-notch, and very client-focused! Thank you TAKATAK!",
    name: "Clark A",
  },
  {
    star: "/img/stars.svg",
    title: "I have 11 services & 6 domains with TAKATAK",
    message:
      "I manage 11 services and 6 domains with TAKATAK. Their service is amazing, and their support — especially via WhatsApp — has been fast, friendly, and incredibly helpful. TAKATAK is highly recommended!",
    name: "Omar",
  },
];

const redemptionFees = [
  { tld: ".com, .net, .org, .info, .biz", price: "CA$100" },
  {
    tld: ".ag, .blackfriday, .diet, .ec, .flowers, .guitars, .hiv, .md, .mg, .nf, .property",
    price: "CA$300",
  },
  {
    tld: ".ai, .game, .id, .kyoto, .lat, .movie, .sc, .so, .sport, .sucks, .versicherung, .zuerich, .watches",
    price: "CA$700",
  },
  { tld: ".new, .theatre, .tickets", price: "CA$1,000" },
  {
    tld: ".auto, .cars, .car, .bank, .insurance, .juegos, .ki, .lotto, .pr, .storage",
    price: "CA$3,150",
  },
  {
    tld: ".dealer, .inc, .protection, .rich, .security, .trust, .voting",
    price: "CA$5,000",
  },
  { tld: ".sexy", price: "CA$6,000" },
  { tld: ".spreadbetting", price: "CA$60,000" },
  { tld: "All other domains", price: "CA$250" },
];

const faqs = [
  {
    question: "What is a domain name?",
    answer:
      "Think of it as your business address online. Instead of a physical storefront, you have a unique domain where your brand lives and customers can connect with you.",
  },
  {
    question: "How do I choose a domain name?",
    answer:
      "That’s where our smart search tool comes in — just type in your ideas and our AI will suggest the perfect match.",
  },
  {
    question: "Can I transfer my domain(s) to TAKATAK?",
    answer:
      "Yes — our transfer process is near-instant. Once your payment clears, check your inbox for a welcome email and access to your TAKATAK dashboard. Transfer-in fee: CA$100, with transfer-out available after 12 months.",
  },
  {
    question: "How long does it take for a newly registered domain to become active?",
    answer:
      "Almost instantly. We’ve built an automated setup process so your domain is live and ready in minutes.",
  },
  {
    question: "Do you provide domain privacy protection services?",
    answer:
      "Absolutely — full WHOIS privacy is included with every TAKATAK domain at no extra charge.",
  },
  {
    question: "Do you provide domain name parking?",
    answer:
      "Yes — we can park unlimited domains for you at no cost, until you’re ready to connect them.",
  },
  {
    question: "Can I manage my domain's DNS settings?",
    answer:
      "Yes — manage A, CNAME, MX, TXT, and more with full control via our dashboard.",
  },
  {
    question: "Can I automatically renew my domain?",
    answer:
      "Yes — auto-renew keeps your site running without interruptions, 24/7.",
  },
  {
    question: "Do you offer bulk discounts on domains?",
    answer:
      "Yes — if you’re registering 50 or more, our team can tailor a pricing plan for you.",
  },
];

export function DomainPageContent() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function toggle(index: number) {
    setOpenIndex(openIndex === index ? null : index);
  }

  return (
    <div className={styles.pagetop}>
      <section className={`${styles.cont} flex flex-col items-center justify-center`}>
        <div className="flex flex-col items-center justify-center gap-[40px] text-white">
          <h1 className="w-[90vw] text-center text-[30px] font-[700] lg:w-[45vw] lg:text-[34px]">
            Power Your Online Success{" "}
            <span className="font-medium">with the Perfect Domain.</span>
          </h1>
          <p className="w-[80vw] text-center text-[18px] font-[600] lg:w-[60vw]">
            Whether you’re building your first website, expanding your business
            presence, or launching the next big brand, TAKATAK makes securing
            your domain name fast, simple, and affordable. From entrepreneurs
            and small businesses to large enterprises, we’ve got the right
            domain for every vision. With instant registration.
          </p>
        </div>
      </section>

      <section
        className={`flex flex-col items-center justify-center gap-[30px] bg-white text-black ${styles.sip}`}
      >
        <h2 className="text-center text-[33px]">
          We get better with{" "}
          <span className="font-extrabold lg:font-bold">every tap.</span>
        </h2>
        <p className="w-[85vw] text-center text-[19px] font-semibold lg:w-[49vw]">
          What’s in a TAKATAK domain? Everything you could want and more. From
          AI‑assisted setup to instant registration, you can expect our best in
          every. Single. One.
        </p>
        <div className="grid grid-cols-1 gap-[20px] sm:grid-cols-2 lg:grid-cols-4">
          {everysip.map((data) => (
            <div
              key={data.title}
              className={`flex flex-col gap-[15px] rounded-[10px] bg-[#f7f8f8] ${styles.dex}`}
            >
              <div
                className={`flex self-start justify-center bg-[#632EF6] ${styles.icon} rounded-[8px] text-[25px] text-white`}
              >
                {data.icon}
              </div>
              <h3 className="w-full text-[18px] font-extrabold lg:font-bold">
                {data.title}
              </h3>
              <p className="font-medium lg:text-[#545964]">{data.details}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        className={`flex flex-col items-center justify-center gap-[30px] bg-white text-black ${styles.sip}`}
      >
        <h2 className="text-center text-[33px] font-extrabold lg:font-bold">
          Locked in with every click!
        </h2>
        <p className="w-[85vw] text-center text-[19px] font-semibold lg:w-[52vw]">
          What do our clients love about TAKATAK? Whatever plan you choose, know
          for certain that you and your domain are in safe, secure, AI-optimized
          hands.
        </p>
        <div className="grid grid-cols-1 gap-[20px] sm:grid-cols-2 lg:grid-cols-3">
          {orderUp.map((data) => (
            <div
              key={data.title}
              className={`flex flex-col gap-[15px] rounded-[10px] bg-[#f7f8f8] ${styles.dex}`}
            >
              <Image
                src={data.icon}
                alt=""
                width={60}
                height={60}
                className={`h-[60px] w-[60px] self-start ${styles.icon}`}
              />
              <h3 className="w-full text-[18px] font-extrabold lg:font-bold">
                {data.title}
              </h3>
              <p className="font-medium lg:text-[#545964]">{data.details}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        className={`flex flex-col items-center justify-around gap-[30px] bg-[#f7f8f8] text-black lg:flex-row ${styles.secur}`}
      >
        <div className="flex flex-col gap-[30px]">
          <h2 className="text-start text-[33px] font-extrabold lg:font-bold">
            Next-level <span className="font-medium">security</span>
          </h2>
          <p className="text-start text-[19px] font-semibold lg:w-[49vw] lg:font-normal lg:text-[#545964]">
            Protect your data and online identity with enterprise-grade,
            AI-driven safeguards. With TAKATAK, you can rest easy with free
            WHOIS privacy, domain locking, and advanced two-factor
            authentication for unbeatable account security.
          </p>
          <hr className="text-[#d8dbdf]" />
          <div className="flex items-center gap-[15px]">
            <IoMdCheckmark className="flex self-center rounded-[50px] bg-[#5d33ff] text-white" />
            <p className="text-[20px] font-medium text-[#5d33ff] lg:font-normal">
              LiteSpeed-optimized servers
            </p>
          </div>
          <div className="flex items-center gap-[15px]">
            <IoMdCheckmark className="flex self-center rounded-[50px] bg-[#5d33ff] text-white" />
            <p className="text-[20px] font-medium text-[#5d33ff] lg:font-normal">
              Zero-downtime architecture
            </p>
          </div>
          <div className="flex items-center gap-[15px]">
            <IoMdCheckmark className="flex w-[6vw] self-center rounded-full bg-[#5d33ff] text-white sm:w-max lg:w-max" />
            <p className="text-[20px] font-medium text-[#5d33ff] lg:font-normal">
              Custom AI-tuned configuration with no timeouts
            </p>
          </div>
        </div>
        <Image
          src="/img/Top.webp"
          alt=""
          width={640}
          height={400}
          className="h-auto max-h-[230px] w-auto lg:max-h-[400px]"
          style={{ width: "auto", height: "auto" }}
        />
      </section>

      <section
        className={`flex flex-col items-center justify-around gap-[30px] bg-white text-black lg:flex-row ${styles.secur}`}
      >
        <Image
          src="/img/Nohidden.webp"
          alt=""
          width={640}
          height={400}
          className="h-auto max-h-[230px] w-auto lg:max-h-[400px]"
          style={{ width: "auto", height: "auto" }}
        />
        <div className="flex flex-col gap-[30px]">
          <h2 className="text-start text-[33px] font-extrabold lg:font-bold">
            No <span className="font-medium">hidden fees</span>
          </h2>
          <p className="text-start text-[19px] font-semibold lg:w-[38vw] lg:font-normal lg:text-[#545964]">
            What you see is what you pay — no surprises. TAKATAK’s transparent
            flat-rate pricing means no extra charges or mystery fees, so you
            always know exactly what your domain will cost.
          </p>
          <hr className="text-[#d8dbdf]" />
          <div className="flex items-center gap-[15px]">
            <IoMdCheckmark className="flex w-[7vw] self-center rounded-full bg-[#5d33ff] text-white sm:w-max lg:w-max" />
            <p className="text-[20px] font-medium text-[#5d33ff] lg:font-normal">
              Flat CA$19.99/mo — no hidden add-ons or upsells
            </p>
          </div>
          <div className="flex items-center gap-[15px]">
            <IoMdCheckmark className="flex w-[7vw] self-center rounded-full bg-[#5d33ff] text-white sm:w-max lg:w-max" />
            <p className="text-[20px] font-medium text-[#5d33ff] lg:font-normal">
              Full breakdown of domain-related costs for total clarity
            </p>
          </div>
          <div className="flex items-center gap-[15px]">
            <IoMdCheckmark className="flex w-[8vw] self-center rounded-full bg-[#5d33ff] text-white sm:w-max lg:w-max" />
            <p className="text-[20px] font-medium text-[#5d33ff] lg:font-normal">
              Goodbye to surprise charges with our straightforward model
            </p>
          </div>
        </div>
      </section>

      <section
        className={`flex flex-col items-center justify-around gap-[30px] bg-[#f7f8f8] text-black lg:flex-row ${styles.secur}`}
      >
        <div className="flex flex-col gap-[30px]">
          <h2 className="text-start text-[33px] font-extrabold lg:font-bold">
            24/7 <span className="font-medium">AI-backed support</span>
          </h2>
          <p className="text-start text-[19px] font-semibold lg:w-[48vw] lg:font-normal lg:text-[#545964]">
            Our dedicated human-plus-AI support team is available around the
            clock to assist you with any domain-related questions or issues. Get
            instant answers, expert guidance, and hands-on troubleshooting
            anytime, anywhere in the world.
          </p>
          <hr className="text-[#d8dbdf]" />
          <div className="flex items-center gap-[15px]">
            <IoMdCheckmark className="flex w-[7vw] self-center rounded-full bg-[#5d33ff] text-white sm:w-max lg:w-max" />
            <p className="text-[20px] font-medium text-[#5d33ff] lg:font-normal">
              Round-the-clock help to resolve your questions quickly
            </p>
          </div>
          <div className="flex items-center gap-[15px]">
            <IoMdCheckmark className="flex w-[8vw] self-center rounded-full bg-[#5d33ff] text-white sm:w-max lg:w-max" />
            <p className="text-[20px] font-medium text-[#5d33ff] lg:font-normal">
              Access expert and AI-powered assistance 24/7 for any concerns
            </p>
          </div>
          <div className="flex items-center gap-[15px]">
            <IoMdCheckmark className="flex w-[10vw] self-center rounded-full bg-[#5d33ff] text-white sm:w-max lg:w-max" />
            <p className="text-[20px] font-medium text-[#5d33ff] lg:font-normal">
              Consistent, reliable support whenever you need help with your
              domain
            </p>
          </div>
        </div>
        <Image
          src="/img/support.webp"
          alt=""
          width={640}
          height={380}
          className="h-auto max-h-[230px] w-auto lg:max-h-[380px]"
          style={{ width: "auto", height: "auto" }}
        />
      </section>

      <section
        className={`flex flex-col items-center justify-center gap-[30px] bg-white text-black ${styles.sip}`}
      >
        <h2 className="text-center text-[33px] font-bold">
          Don’t just take our word for it.
        </h2>
        <p className="w-[85vw] text-center text-[19px] font-normal lg:w-[52vw] lg:text-[#545964]">
          We love our domain customers and making their day — plus, they say
          “TAKATAK delivers” way better than we do.
        </p>
        <div className="grid grid-cols-1 gap-[20px] sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-3">
          {customers.map((cus) => (
            <div
              key={cus.name}
              className={`flex flex-col gap-[15px] bg-[#f7f8f8] ${styles.dex}`}
            >
              <Image
                src={cus.star}
                alt=""
                width={120}
                height={20}
                className="h-auto max-h-[20px] w-auto self-start"
                style={{ width: "auto", height: "auto" }}
              />
              <h3 className="w-full text-[18px] font-bold">{cus.title}</h3>
              <p className="lg:text-[#545964]">{cus.message}</p>
              <p className="font-bold underline underline-offset-[3px]">
                {cus.name}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section
        className={`flex flex-col items-start justify-around gap-[30px] bg-[#5D31FF] text-white lg:flex-row lg:items-center ${styles.chat}`}
      >
        <div className="flex flex-col gap-[15px]">
          <h4 className="text-[#B2ADFE]">DOMAINS SUPPORT</h4>
          <h2 className="text-[33px] lg:w-[40vw] lg:text-[40px]">
            Give your domain questions an AI boost of solutions.
          </h2>
          <p className="w-full text-[20px]">
            Our support team is available 24/7 for any domain questions or needs
            you have. And we’re not just running on coffee and late-night
            shifts — our experts and AI systems are based worldwide, so you’re
            always getting our best energy, instantly matched to yours.
          </p>
          <button
            type="button"
            onClick={() => openLiveChat({ page: "domain" })}
            className={`${styles.cbtn} w-max rounded-[8px] bg-white text-[18px] text-black`}
          >
            Let’s have a chat
          </button>
        </div>
        <Image
          src="/img/chat.webp"
          alt=""
          width={900}
          height={500}
          className="h-auto max-h-[280px] w-auto object-contain sm:max-h-[650px] lg:max-h-[500px]"
          style={{ width: "auto", height: "auto" }}
        />
      </section>

      <section
        className={`flex flex-col items-center justify-center gap-[30px] bg-[#f7f8f8] text-black ${styles.sip}`}
      >
        <h2 className="mb-4 text-center text-3xl text-[#1a1a4b] lg:text-[40px]">
          Redemption Fees
        </h2>
        <p className="w-[85vw] text-center text-[20px] text-gray-600 lg:w-[55vw]">
          Many domain registries charge an additional fee if a domain is not
          renewed on time. Since these fees vary depending on the registry,
          we’ve listed the current prices for clarity and transparency.
        </p>
        <div className="w-full max-w-4xl overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-100">
                <th
                  className={`text-sm font-semibold text-[#1a1a4b] ${styles.tb}`}
                >
                  Tld
                </th>
                <th
                  className={`relative p-4 text-sm font-semibold text-[#1a1a4b] ${styles.prc}`}
                >
                  <div className="absolute inset-y-0 -left-3 w-px bg-gray-300" />
                  Price
                </th>
              </tr>
            </thead>
            <tbody>
              {redemptionFees.map((item) => (
                <tr key={item.tld} className="border-t border-gray-200">
                  <td className={`text-sm text-gray-700 ${styles.tb}`}>
                    {item.tld}
                  </td>
                  <td
                    className={`relative p-4 text-sm font-medium text-gray-900 ${styles.prc}`}
                  >
                    <div className="absolute inset-y-0 -left-3 w-px bg-gray-200" />
                    {item.price}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className={`flex flex-col items-start justify-around gap-[30px] bg-white text-white lg:flex-row ${styles.secur}`}
      >
        <div className="flex flex-col gap-[30px]">
          <h2 className="w-full max-w-4xl text-3xl text-[#1a1a4b] md:max-w-fit lg:w-max lg:text-[40px]">
            Frequently asked questions
          </h2>
          <p className="w-full max-w-4xl text-[20px] text-gray-600">
            Here’s a shot of our most frequently asked domain questions. If
            you’re still stirring for answers, pop into our live chat and one of
            our experts will be happy to assist you.
          </p>
        </div>

        <div className="w-full max-w-4xl space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={faq.question}
              className={`flex flex-col gap-[20px] border-b border-gray-200 ${styles.tb}`}
            >
              <button
                type="button"
                onClick={() => toggle(index)}
                className={`flex w-full items-center justify-between text-left text-[20px] text-[#1a1a4b] transition hover:opacity-80 ${styles.qs}`}
              >
                <span className="w-[70vw] lg:w-max">{faq.question}</span>
                {openIndex === index ? (
                  <ChevronUp size={20} className="text-[#1a1a4b]" />
                ) : (
                  <ChevronDown size={20} className="text-[#1a1a4b]" />
                )}
              </button>
              {openIndex === index ? (
                <div className="pb-4 text-[16px] text-gray-700">
                  {faq.answer}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
