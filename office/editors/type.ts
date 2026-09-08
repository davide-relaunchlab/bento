import {brand} from '../client/brand.ts';
import '../client/brand.css';
document.documentElement.classList.add('dw-host');
import './type-host.css';
import { getNativeHost } from './host.ts';
import { setOfficeHost } from '../../type/src/officehost.ts';
setOfficeHost(getNativeHost('bento/type'));
await import('../../type/src/main.ts');
const narrow=matchMedia('(max-width: 700px)');
function collapse(){if(narrow.matches)document.querySelector('.t-main')?.classList.add('t-side-off','t-props-off');}
collapse();narrow.addEventListener('change',collapse);

const brandMark=document.querySelector('#mark');if(brandMark)brandMark.innerHTML=brand;
