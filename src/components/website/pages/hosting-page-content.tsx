"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { FaCpanel } from "react-icons/fa";
import { BsDatabaseFillCheck } from "react-icons/bs";
import { RiShieldUserLine } from "react-icons/ri";
import { IoMdCheckmark, IoIosExpand } from "react-icons/io";
import { SlSpeedometer } from "react-icons/sl";
import { AiOutlineRetweet } from "react-icons/ai";
import { RxRocket } from "react-icons/rx";
import { ChevronDown, ChevronUp, Repeat } from "lucide-react";

import { Link } from "@/lib/website/nav";
import { openLiveChat } from "@/lib/website/chat-provider";
import styles from "./hosting-page.module.css";

const everysip: { icon: ReactNode; title: string; details: string }[] = [
  {
    icon: <RxRocket />,
    title: "One-click installation",
    details:
      "Launch WordPress in seconds with our guided one-click setup. Get your shop, blog, or landing page live without delay.",
  },
  {
    icon: <RiShieldUserLine />,
    title: "Security for WordPress",
    details:
      "Stay protected with tailored WordPress security, AI-driven monitoring, and advanced WordPress-tuned hardening boost stability and guard against threats—24/7.",
  },
  {
    icon: <AiOutlineRetweet />,
    title: "Automatic backups",
    details:
      "Enjoy worry-free backups stored offsite, with easy browsing, quick restores, and downloads—no extra plugins.",
  },
  {
    icon: <Repeat />,
    title: "Free migrations",
    details:
      "Move your site with zero downtime. We handle the transfer and verification, including multiple sites at no extra cost.",
  },
  {
    icon: <FaCpanel />,
    title: "cPanel control panel",
    details:
      "Manage sites, PHP, DNS, and files with cPanel/WHM plus our clean dashboard—Linux-friendly and simple to use.",
  },
  {
    icon: <BsDatabaseFillCheck />,
    title: "Unlimited databases",
    details:
      "Create as many MySQL/MariaDB databases as you need, with ample space to grow apps, content, and stores.",
  },
  {
    icon: <SlSpeedometer />,
    title: "Speed optimized",
    details:
      "Handle traffic spikes with elastic resources so you can grow your audience with no downtime.",
  },
  {
    icon: <IoIosExpand />,
    title: "Scalable resources",
    details:
      "Enjoy hassle‑free contact management — make changes, do trades or transfers, or update contact details in bulk with ease.",
  },
];

const orderUp = [
  {
    icon: "/img/mig.svg",
    title: "Free migration",
    details:
      "Transfer your website to our platform at zero cost, ensuring a smooth transition with no downtime or disconnection for your audience.",
  },
  {
    icon: "/img/setup.svg",
    title: "Instant setup",
    details:
      "With rapid site setup from our expert + AI team, enjoy swift deployment of your hosting plan and a quick launch for your website.",
  },
  {
    icon: "/img/Mon.svg",
    title: "Transparent pricing",
    details:
      "Get what you pay for—no surprises. Clear, straightforward pricing with no hidden fees, plus useful features included.",
  },
  {
    icon: "/img/world.svg",
    title: "Free SSL certificates",
    details:
      "Secure your site from day one with automatically issued SSL. Encrypt traffic, boost trust, and meet best‑practice standards.",
  },
  {
    icon: "/img/support.svg",
    title: "24/7 expert support",
    details:
      "From managed migrations to tricky PHP errors, rely on AI‑backed specialists to enhance performance and resolve issues quickly.",
  },
  {
    icon: "/img/global.svg",
    title: "Global service",
    details:
      "Choose servers across worldwide regions for reliable performance, low latency, and proximity to your target audience.",
  },
  {
    icon: "/img/99.svg",
    title: "99.9% uptime guarantee",
    details:
      "Rest easy with our uptime assurance—your website stays consistently available, building reliability and trust for your brand.",
  },
  {
    icon: "/img/green.svg",
    title: "Carbon‑neutral hosting",
    details:
      "Run greener infrastructure with our carbon‑neutral approach, reducing impact while maintaining top‑tier hosting quality.",
  },
];

const customers = [
  {
    title: "Polite and professional service",
    message:
      "The TAKATAK support team handled my WordPress issue quickly and professionally. I couldn’t get my site running until their AI-powered setup walked me through it. Everything was resolved smoothly, and I’m grateful for their polite and expert service.",
    name: "Wealth Angel",
  },
  {
    title: "Fastest WP hosting and professional support",
    message: "Fastest WP hosting and professional support",
    name: "Denys",
  },
  {
    title: "PHP issue solved in one chat",
    message:
      "I had a PHP problem that broke my site, and TAKATAK solved it in a single chat. I previously waited a week at another host with no fix — TAKATAK fixed everything instantly. Their reliability is unmatched.",
    name: "Redline Designs",
  },
];

const faqs = [
  {
    question: "What is WordPress hosting?",
    answer:
      "If you already run a WordPress site, this is tailor-made for you. TAKATAK's WordPress hosting ensures your site runs on servers fully optimized for WordPress with enterprise-grade security, speed, and uptime.",
  },
  {
    question: "Do all of your WordPress support plans?",
    answer: "Yes — every single plan is built with WordPress in mind.",
  },
  {
    question: "Which WordPress hosting plan is best for me?",
    answer:
      "Our plans are designed to fit all levels of business — from personal blogs to high-traffic eCommerce stores. The best choice depends on your visitors, features (like WooCommerce), and how much you want TAKATAK to manage for you. If you'd like expert guidance, our team is always ready to help.",
  },
  {
    question: "I already have a WordPress site with another host, can I migrate it to TAKATAK?",
    answer:
      "Absolutely! Just open a migration request in your dashboard, share your old host logins, and we'll move your site over with zero downtime — usually in under 24 hours.",
  },
  {
    question: "Do you offer specific WordPress support?",
    answer:
      "Yes. Our support team is made up of WordPress specialists available 24/7. If you're ever in a tough spot, just reach out — we'll get you back on track quickly.",
  },
];

function PurchaseLink({
  isAuthenticated,
  className,
  children,
}: {
  isAuthenticated: boolean;
  className: string;
  children: ReactNode;
}) {
  if (isAuthenticated) {
    return (
      <Link to="/checkout" className={className}>
        {children}
      </Link>
    );
  }

  return (
    <Link to="/login" search={{ next: "/checkout" }} className={className}>
      {children}
    </Link>
  );
}

export function HostingPageContent({
  isAuthenticated = false,
}: {
  isAuthenticated?: boolean;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const ctaClass = `${styles.cbtn} w-max rounded-[8px] text-[18px] font-semibold`;

  return (
    <div className={styles.pagetop}>
      <section
        className={`flex flex-col items-start justify-around gap-[30px] text-white lg:flex-row lg:items-center ${styles.host}`}
      >
        <div className={`flex flex-col gap-[15px] ${styles.hos}`}>
          <p className="text-[#b3aeff]">HOSTING FOR WORDPRESS</p>
          <h1 className="text-[33px] lg:w-[40vw] lg:text-[40px]">
            <span className="font-bold">Power up success</span> with our hosting
            for Website
          </h1>
          <p className="w-full text-[20px]">
            Ready to create without limits? Our WordPress hosting is the perfect
            mix of speed, AI security, and nonstop support. We’ve crafted hosting
            solutions that are never watered down, ensuring your site performs at
            peak efficiency. Whether you’re launching a personal blog or scaling
            a full e-commerce store, our plans adapt to your needs.
          </p>
          <PurchaseLink isAuthenticated={isAuthenticated} className={ctaClass}>
            Find the plan for me
          </PurchaseLink>
        </div>
        <Image
          src="/img/hosting.webp"
          alt=""
          width={720}
          height={400}
          className="h-[300px] w-full object-contain sm:h-[500px] lg:h-[400px]"
        />
      </section>

      <section
        className={`flex flex-col items-center justify-center gap-[30px] bg-white text-black ${styles.sip}`}
      >
        <h2 className="text-center text-[33px]">
          Pick a plan and
          <span className="font-bold"> supercharge your WordPress.</span>
        </h2>
        <p className="w-[85vw] text-center text-[19px] font-semibold lg:w-[49vw]">
          Order your go-to setup, or explore a bold new option. Our TAKATAK
          WordPress hosting plans are built to match any project — including
          yours.
        </p>
      </section>

      <section
        className={`flex flex-col items-center justify-center gap-[30px] bg-white text-black ${styles.sip}`}
      >
        <h2 className="text-center text-[33px]">
          Our hosting gets{" "}
          <span className="font-extrabold lg:font-bold">
            smarter with every click.
          </span>
        </h2>
        <p className="w-[85vw] text-center text-[19px] font-semibold lg:w-[49vw]">
          What do our clients love about TAKATAK WordPress hosting? Whatever plan
          you choose, know for certain your site is safe, fast, and AI-optimized
          around the clock.
        </p>
        <div className="grid grid-cols-1 gap-[20px] sm:grid-cols-2 lg:grid-cols-4">
          {everysip.map((data) => (
            <div
              key={data.title}
              className={`flex flex-col gap-[15px] rounded-[10px] bg-[#f7f8f8] ${styles.dex}`}
            >
              <div
                className={`flex self-start justify-center rounded-[8px] bg-[#632EF6] text-[25px] text-white ${styles.icon}`}
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
          Order up!
        </h2>
        <p className="w-[85vw] text-center text-[19px] font-semibold lg:w-[52vw]">
          What do our clients love about TAKATAK? Whatever plan you choose, know
          for certain that you and your site are in safe, AI‑optimized hands.
        </p>
        <div className="grid grid-cols-1 gap-[20px] sm:grid-cols-2 lg:grid-cols-4">
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
            We’ve <span className="font-medium">optimized performance</span>{" "}
            especially for WordPress.
          </h2>
          <p className="text-start text-[19px] font-semibold lg:w-[49vw] lg:font-normal lg:text-[#545964]">
            We want every part of your TAKATAK WordPress hosting experience to be
            smooth, fast, and reliable. Our LiteSpeed servers and AI caching
            deliver lightning-fast load times, zero downtime, and a custom
            WordPress setup designed to eliminate interruptions.
          </p>
          <CheckRow text="LiteSpeed servers with AI tuning for maximum speed" />
          <CheckRow text="Seamless operation backed by zero-downtime architecture" />
          <CheckRow text="Custom WordPress optimization for uninterrupted performance" />
        </div>
        <Image
          src="/img/optimise.webp"
          alt=""
          width={480}
          height={400}
          className="h-[230px] w-auto object-contain lg:h-[400px]"
        />
      </section>

      <section
        className={`flex flex-col items-center justify-around gap-[30px] bg-white text-black lg:flex-row ${styles.secur}`}
      >
        <Image
          src="/img/effortlessly.webp"
          alt=""
          width={480}
          height={400}
          className="h-[230px] w-auto object-contain lg:h-[400px]"
        />
        <div className="flex flex-col gap-[30px]">
          <h2 className="text-start text-[33px] font-extrabold lg:font-bold">
            Effortlessly <span className="font-medium">build your WordPress site</span>
          </h2>
          <p className="text-start text-[19px] font-semibold lg:w-[38vw] lg:font-normal lg:text-[#545964]">
            Build a site that feels effortless — launch instantly with TAKATAK’s
            one-click WordPress install, the Gutenberg block editor, and access
            to countless plugins and themes.
          </p>
          <CheckRow text="Instant WordPress installation" />
          <CheckRow text="No technical background required" />
          <CheckRow text="Access to premium themes, plugins, and AI guidance" />
        </div>
      </section>

      <section
        className={`flex flex-col items-center justify-around gap-[30px] bg-[#f7f8f8] text-black lg:flex-row ${styles.secur}`}
      >
        <div className="flex flex-col gap-[30px]">
          <h2 className="text-start text-[33px]">
            Let us handle your{" "}
            <span className="font-extrabold lg:font-bold">
              free WordPress migration.
            </span>
          </h2>
          <p className="text-start text-[19px] font-semibold lg:w-[48vw] lg:font-normal lg:text-[#545964]">
            Seamlessly move your WordPress site to TAKATAK — no hassle, no
            downtime. Our expert-led migration ensures a smooth transfer with
            AI-assisted setup and hands-on guidance.
          </p>
          <CheckRow text="Expert-led free migrations for existing sites" />
          <CheckRow text="Zero interruptions during the migration process" />
          <CheckRow text="AI-powered + human support throughout the journey" />
        </div>
        <Image
          src="/img/migration.webp"
          alt=""
          width={480}
          height={380}
          className="h-[230px] w-auto object-contain lg:h-[380px]"
        />
      </section>

      <section
        className={`flex flex-col items-center justify-center gap-[30px] bg-white text-black ${styles.sip}`}
      >
        <h2 className="text-center text-[33px]">
          Don’t just <span className="font-bold">take our word for it.</span>
        </h2>
        <p className="w-[85vw] text-center text-[19px] font-normal lg:w-[52vw] lg:text-[#545964]">
          We love our TAKATAK WordPress hosting clients and making their day —
          plus, they say “TAKATAK is unstoppable” way better than we do.
        </p>
        <div className="grid grid-cols-1 gap-[20px] lg:grid-cols-3">
          {customers.map((customer) => (
            <div
              key={customer.name}
              className={`flex flex-col gap-[15px] ${styles.dex} bg-[#f7f8f8]`}
            >
              <Image
                src="/img/stars.svg"
                alt=""
                width={80}
                height={20}
                className="h-[20px] w-auto self-start"
              />
              <h3 className="w-full text-[18px] font-bold">{customer.title}</h3>
              <p className="lg:text-[#545964]">{customer.message}</p>
              <p className="font-bold underline underline-offset-[3px]">
                {customer.name}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section
        className={`flex flex-col items-start justify-around gap-[30px] text-white lg:flex-row lg:items-center ${styles.chat}`}
      >
        <div className={`flex flex-col gap-[15px] ${styles.assi}`}>
          <p className="text-[#B2ADFE]">WORDPRESS ASSISTANCE</p>
          <h2 className="text-[33px] lg:w-[40vw] lg:text-[40px]">
            Got questions? We&apos;ll deliver the perfect solution.
          </h2>
          <p className="w-full text-[20px]">
            Our expert + AI support team is available 24/7 for any WordPress
            needs. We don&apos;t rely on caffeine or late-night rushes — our
            specialists are based worldwide, ensuring you always get the right
            answer, delivered fast and at full strength.
          </p>
          <button
            type="button"
            onClick={() => openLiveChat()}
            className={`w-max rounded-[8px] bg-white text-[18px] text-black ${styles.cbtn}`}
          >
            Let’s have a chat
          </button>
        </div>
        <Image
          src="/img/assistant.webp"
          alt=""
          width={720}
          height={500}
          className="h-[300px] w-full object-contain lg:h-[500px]"
        />
      </section>

      <section
        className={`flex flex-col items-start justify-around gap-[30px] bg-white text-white lg:flex-row ${styles.secur}`}
      >
        <div className="flex flex-col flex-wrap gap-[30px]">
          <h2 className="w-full text-3xl text-[#1a1a4b] lg:w-max lg:text-[30px]">
            Frequently asked questions
          </h2>
          <p className="w-full max-w-4xl text-[20px] text-gray-600">
            Here&apos;s a quick round-up of our most common TAKATAK WordPress
            Hosting questions. If you&apos;re still looking for answers, jump
            into our live chat and one of our AI + human experts will be there
            for you.
          </p>
        </div>
        <div className="w-full max-w-full space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={faq.question}
              className={`flex flex-col gap-[20px] border-b border-gray-200 ${styles.tb}`}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenIndex((current) => (current === index ? null : index))
                }
                className={`flex w-full items-center justify-between text-left text-[20px] text-[#1a1a4b] ${styles.qs}`}
              >
                <span className="w-[70vw] lg:w-max">{faq.question}</span>
                {openIndex === index ? (
                  <ChevronUp size={20} className="text-[#1a1a4b]" />
                ) : (
                  <ChevronDown size={20} className="text-[#1a1a4b]" />
                )}
              </button>
              {openIndex === index ? (
                <p className="pb-4 text-[16px] text-gray-700">{faq.answer}</p>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CheckRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-[15px]">
      <IoMdCheckmark className="flex w-[7vw] shrink-0 self-center rounded-full bg-[#5d33ff] text-white sm:w-max lg:w-max" />
      <p className="text-[20px] font-medium text-[#5d33ff] lg:font-normal">
        {text}
      </p>
    </div>
  );
}
