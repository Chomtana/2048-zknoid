import Link from 'next/link';
import Image from 'next/image';
import zknoidLogo from '@/public/image/zknoid-logo.svg';
import { SOCIALS } from '@/constants/socials';

export const Footer = () => {
  return (
    <div className={'mx-6 my-10 flex flex-col justify-between gap-4'}>
      <div className={'grid grid-cols-3 grid-rows-1'}>
        <Link
          href={'https://app.zknoid.io'}
          target="_blank"
          rel="noopener noreferrer"
          className={'cursor-pointer ease-in-out hover:opacity-80'}
        >
          <Image src={zknoidLogo} alt={'ZkNoid Logo'} />
        </Link>
        <div
          className={
            'flex flex-row items-center justify-center gap-4 self-center'
          }
        >
          <Link
            className="cursor-pointer text-lg ease-in-out even:text-right hover:opacity-80 lg:text-xl"
            href={'https://github.com/ZkNoid'}
            target="_blank"
            rel="noopener noreferrer"
          >
            Github
          </Link>
          <Link
            className="cursor-pointer text-lg ease-in-out even:text-right hover:opacity-80 lg:text-xl"
            href={'https://docs.zknoid.io'}
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </Link>
          <Link
            className="cursor-pointer text-lg ease-in-out even:text-right hover:opacity-80 lg:text-xl"
            href={'https://zknoid.medium.com'}
            target="_blank"
            rel="noopener noreferrer"
          >
            Blog
          </Link>
        </div>
      </div>
      <div className={'grid grid-cols-3 grid-rows-1'}>
        <div className="flex gap-3">
          {SOCIALS.map((x) => (
            <Link href={x.link} key={x.id}>
              <Image alt={x.name} src={x.whiteImage} />
            </Link>
          ))}
        </div>
        <div className={'col-start-3 col-end-3 text-end'}>
          © 2024 ZkNoid: all rights reserved
        </div>
      </div>
    </div>
  );
};
