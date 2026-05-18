import type { WorkEasyCategory, WorkEasyComponentRecord } from "@motion-tool/core";

export const generatedWorkEasyRecords: Array<{ category: WorkEasyCategory; record: WorkEasyComponentRecord }> = [
  {
    "category": "buttons",
    "record": {
      "id": "1-button",
      "title": "1 Button",
      "author": "开发者",
      "type": "html",
      "framework": "vanilla",
      "tags": [
        "button"
      ],
      "description": "1 Button 组件",
      "version": "1.0.0",
      "htmlContent": "<div class=\"comp-1-button-container\"><button class=\"bookmarkBtn\"><span class=\"IconContainer\"><svg viewBox=\"0 0 384 512\" height=\"0.9em\" class=\"icon\"><path d=\"M0 48V487.7C0 501.1 10.9 512 24.3 512c5 0 9.9-1.5 14-4.4L192 400 345.7 507.6c4.1 2.9 9 4.4 14 4.4c13.4 0 24.3-10.9 24.3-24.3V48c0-26.5-21.5-48-48-48H48C21.5 0 0 21.5 0 48z\" ></path></svg></span><p class=\"text\">Save</p></button></div>",
      "cssContent": ".comp-1-button-container{position: relative;overflow: hidden} .comp-1-button-container .bookmarkBtn{width: 100px;height: 40px;border-radius: 40px;border: 1px solid rgba(255,255,255,0.349);background-color: rgb(12,12,12);display: flex;align-items: center;justify-content: center;cursor: pointer;transition-duration: 0.3s;overflow: hidden} .comp-1-button-container .IconContainer{width: 30px;height: 30px;background: linear-gradient(to bottom,rgb(255,136,255),rgb(172,70,255));border-radius: 50px;display: flex;align-items: center;justify-content: center;overflow: hidden;z-index: 2;transition-duration: 0.3s} .comp-1-button-container .icon{border-radius: 1px} .comp-1-button-container .text{height: 100%;width: 60px;display: flex;align-items: center;justify-content: center;color: white;z-index: 1;transition-duration: 0.3s;font-size: 1.04em} .comp-1-button-container .bookmarkBtn:hover .IconContainer{width: 90px;transition-duration: 0.3s} .comp-1-button-container .bookmarkBtn:hover .text{transform: translate(10px);width: 0;font-size: 0;transition-duration: 0.3s} .comp-1-button-container .bookmarkBtn:active{transform: scale(0.95);transition-duration: 0.3s}"
    }
  },
  {
    "category": "buttons",
    "record": {
      "id": "2-button",
      "title": "2 Button",
      "author": "开发者",
      "type": "html",
      "framework": "vanilla",
      "tags": [
        "button"
      ],
      "description": "2 Button 组件",
      "version": "1.0.0",
      "htmlContent": "<div class=\"comp-2-button-container\"><button class=\"button\"><div class=\"button-outer\"><div class=\"button-inner\"><span>Press me</span></div></div></button></div>",
      "cssContent": ".comp-2-button-container{position: relative;overflow: hidden} .comp-2-button-container .button{all: unset;cursor: pointer;-webkit-tap-highlight-color: rgba(0,0,0,0);position: relative;border-radius: 100em;background-color: rgba(0,0,0,0.75);box-shadow: -0.15em -0.15em 0.15em -0.075em rgba(5,5,5,0.25),0.0375em 0.0375em 0.0675em 0 rgba(5,5,5,0.1)} .comp-2-button-container .button::after{content: \"\";position: absolute;z-index: 0;width: calc(100% + 0.3em);height: calc(100% + 0.3em);top: -0.15em;left: -0.15em;border-radius: inherit;background: linear-gradient( -135deg,rgba(5,5,5,0.5),transparent 20%,transparent 100% );filter: blur(0.0125em);opacity: 0.25;mix-blend-mode: multiply} .comp-2-button-container .button .button-outer{position: relative;z-index: 1;border-radius: inherit;transition: box-shadow 300ms ease;will-change: box-shadow;box-shadow: 0 0.05em 0.05em -0.01em rgba(5,5,5,1),0 0.01em 0.01em -0.01em rgba(5,5,5,0.5),0.15em 0.3em 0.1em -0.01em rgba(5,5,5,0.25)} .comp-2-button-container .button:hover .button-outer{box-shadow: 0 0 0 0 rgba(5,5,5,1),0 0 0 0 rgba(5,5,5,0.5),0 0 0 0 rgba(5,5,5,0.25)} .comp-2-button-container .button-inner{--inset: 0.035em;position: relative;z-index: 1;border-radius: inherit;padding: 1em 1.5em;background-image: linear-gradient( 135deg,rgba(230,230,230,1),rgba(180,180,180,1) );transition: box-shadow 300ms ease,clip-path 250ms ease,background-image 250ms ease,transform 250ms ease;will-change: box-shadow,clip-path,background-image,transform;overflow: clip;clip-path: inset(0 0 0 0 round 100em);box-shadow: 0 0 0 0 inset rgba(5,5,5,0.1),-0.05em -0.05em 0.05em 0 inset rgba(5,5,5,0.25),0 0 0 0 inset rgba(5,5,5,0.1),0 0 0.05em 0.2em inset rgba(255,255,255,0.25),0.025em 0.05em 0.1em 0 inset rgba(255,255,255,1),0.12em 0.12em 0.12em inset rgba(255,255,255,0.25),-0.075em -0.25em 0.25em 0.1em inset rgba(5,5,5,0.25)} .comp-2-button-container .button:hover .button-inner{clip-path: inset( clamp(1px,0.0625em,2px) clamp(1px,0.0625em,2px) clamp(1px,0.0625em,2px) clamp(1px,0.0625em,2px) round 100em );box-shadow: 0.1em 0.15em 0.05em 0 inset rgba(5,5,5,0.75),-0.025em -0.03em 0.05em 0.025em inset rgba(5,5,5,0.5),0.25em 0.25em 0.2em 0 inset rgba(5,5,5,0.5),0 0 0.05em 0.5em inset rgba(255,255,255,0.15),0 0 0 0 inset rgba(255,255,255,1),0.12em 0.12em 0.12em inset rgba(255,255,255,0.25),-0.075em -0.12em 0.2em 0.1em inset rgba(5,5,5,0.25)} .comp-2-button-container .button .button-inner span{position: relative;z-index: 4;font-family: \"Inter\",sans-serif;letter-spacing: -0.05em;font-weight: 500;color: rgba(0,0,0,0);background-image: linear-gradient( 135deg,rgba(25,25,25,1),rgba(75,75,75,1) );-webkit-background-clip: text;background-clip: text;transition: transform 250ms ease;display: block;will-change: transform;text-shadow: rgba(0,0,0,0.1) 0 0 0.1em;-webkit-user-select: none;-moz-user-select: none;-ms-user-select: none;user-select: none} .comp-2-button-container .button:hover .button-inner span{transform: scale(0.975)} .comp-2-button-container .button:active .button-inner{transform: scale(0.975)}"
    }
  },
  {
    "category": "buttons",
    "record": {
      "id": "3-button",
      "title": "3 Button",
      "author": "开发者",
      "type": "html",
      "framework": "vanilla",
      "tags": [
        "button"
      ],
      "description": "3 Button 组件",
      "version": "1.0.0",
      "htmlContent": "<div class=\"comp-3-button-container\"><button data-label=\"Register\" class=\"rainbow-hover\"><span class=\"sp\">Register</span></button></div>",
      "cssContent": ".comp-3-button-container{position: relative;overflow: hidden} .comp-3-button-container .rainbow-hover{font-size: 16px;font-weight: 700;color: #ff7576;background-color: #2B3044;border: none;outline: none;cursor: pointer;padding: 12px 24px;position: relative;line-height: 24px;border-radius: 9px;box-shadow: 0px 1px 2px #2B3044,0px 4px 16px #2B3044;transform-style: preserve-3d;transform: scale(var(--s,1)) perspective(600px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));perspective: 600px;transition: transform 0.1s} .comp-3-button-container .sp{background: linear-gradient( 90deg,#866ee7,#ea60da,#ed8f57,#fbd41d,#2cca91 );-webkit-background-clip: text;-webkit-text-fill-color: transparent;background-clip: text;text-fill-color: transparent;display: block} .comp-3-button-container .rainbow-hover:active{transition: 0.3s;transform: scale(0.93)}"
    }
  },
  {
    "category": "buttons",
    "record": {
      "id": "11-button",
      "title": "11 Button",
      "author": "开发者",
      "type": "html",
      "framework": "vanilla",
      "tags": [
        "button"
      ],
      "description": "11 Button 组件",
      "version": "1.0.0",
      "htmlContent": "<div class=\"comp-11-button-container\"><button><p>Follow me</p><svg viewBox=\"0 0 16 16\" class=\"bi bi-whatsapp\" fill=\"currentColor\" height=\"16\" width=\"16\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016a5.54 5.54 0 0 1 .016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4z\"></path></svg></button></div>",
      "cssContent": ".comp-11-button-container{position: relative;overflow: hidden} button{background-color: #fff;border: 1px solid #0077b5;padding: 5px;position: relative;width: 7.2em;height: 2em;transition: 0.5s;font-size: 17px;border-radius: 0.4em} .comp-11-button-container button p{position: absolute;top: 0.4em;left: 1.2em;margin: 0;padding: 0;transition: .5s;color: #0077b5} .comp-11-button-container button svg{position: absolute;top: 0.45em;right: 0.5em;margin: 0;padding: 0;opacity: 0;transition: 0.5s;height: 1em;fill: #fff } .comp-11-button-container button:hover p{left: 0.6em;color: #fff } .comp-11-button-container button:hover svg{opacity: 1} .comp-11-button-container button:hover{background-color: #0077b5}"
    }
  },
  {
    "category": "buttons",
    "record": {
      "id": "12-button",
      "title": "12 Button",
      "author": "开发者",
      "type": "html",
      "framework": "vanilla",
      "tags": [
        "button"
      ],
      "description": "12 Button 组件",
      "version": "1.0.0",
      "htmlContent": "<div class=\"comp-12-button-container\"><button class=\"button\"><svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 24\"><path d=\"m18 0 8 12 10-8-4 20H4L0 4l10 8 8-12z\"></path></svg> Unlock Pro </button></div>",
      "cssContent": ".comp-12-button-container{position: relative;overflow: hidden} .comp-12-button-container .button{width: fit-content;display: flex;padding: 1.2em 1rem;cursor: pointer;gap: 0.4rem;font-weight: bold;border-radius: 30px;text-shadow: 2px 2px 3px rgb(136 0 136 / 50%);background: linear-gradient(15deg,#880088,#aa2068,#cc3f47,#de6f3d,#f09f33,#de6f3d,#cc3f47,#aa2068,#880088) no-repeat;background-size: 300%;color: #fff;border: none;background-position: left center;box-shadow: 0 30px 10px -20px rgba(0,0,0,.2);transition: background .3s ease} .comp-12-button-container .button:hover{background-size: 320%;background-position: right center} .comp-12-button-container .button:hover svg{fill: #fff} .comp-12-button-container .button svg{width: 23px;fill: #f09f33;transition: .3s ease}"
    }
  },
  {
    "category": "buttons",
    "record": {
      "id": "13-button",
      "title": "13 Button",
      "author": "开发者",
      "type": "html",
      "framework": "vanilla",
      "tags": [
        "button"
      ],
      "description": "13 Button 组件",
      "version": "1.0.0",
      "htmlContent": "<div class=\"comp-13-button-container\"><button><span>Button</span></button></div>",
      "cssContent": ".comp-13-button-container{position: relative;overflow: hidden} .comp-13-button-container button{background: #fff;border: none;padding: 10px 20px;display: inline-block;font-size: 15px;font-weight: 600;width: 120px;text-transform: uppercase;cursor: pointer;transform: skew(-21deg)} .comp-13-button-container span{display: inline-block;transform: skew(21deg)} .comp-13-button-container button::before{content: '';position: absolute;top: 0;bottom: 0;right: 100%;left: 0;background: rgb(20,20,20);opacity: 0;z-index: -1;transition: all 0.5s} .comp-13-button-container button:hover{color: #fff} .comp-13-button-container button:hover::before{left: 0;right: 0;opacity: 1}"
    }
  },
  {
    "category": "buttons",
    "record": {
      "id": "14-button",
      "title": "14 Button",
      "author": "开发者",
      "type": "html",
      "framework": "vanilla",
      "tags": [
        "button"
      ],
      "description": "14 Button 组件",
      "version": "1.0.0",
      "htmlContent": "<div class=\"comp-14-button-container\"><button class=\"btn2\"><span class=\"spn2\">HELLO !</span></button></div>",
      "cssContent": ".comp-14-button-container{position: relative;overflow: hidden} .comp-14-button-container .btn2{position: relative;display: inline-block;padding: 15px 30px;border: 2px solid #fefefe;text-transform: uppercase;color: #fefefe;text-decoration: none;font-weight: 600;font-size: 20px;transition: 0.3s;background-color: transparent;cursor: pointer} .comp-14-button-container .btn2::before{content: \"\";position: absolute;top: -2px;left: -2px;width: calc(100% + 6px);height: calc(100% + 2px);background-color: #212121;transition: 0.3s ease-out;transform: scaleY(1)} .comp-14-button-container .btn2::after{content: \"\";position: absolute;top: -2px;left: -2px;width: calc(100% + 4px);height: calc(100% - 50px);background-color: #212121;transition: 0.3s ease-out;transform: scaleY(1)} .comp-14-button-container .btn2:hover::before{transform: translateY(-25px);height: 0} .comp-14-button-container .btn2:hover::after{transform: scaleX(0);transition-delay: 0.15s} .comp-14-button-container .btn2:hover{border: 2px solid #fefefe} .comp-14-button-container .btn2 .spn2{position: relative;z-index: 3;text-decoration: none;border: none;background-color: transparent}"
    }
  },
  {
    "category": "buttons",
    "record": {
      "id": "15-button",
      "title": "15 Button",
      "author": "开发者",
      "type": "html",
      "framework": "vanilla",
      "tags": [
        "button"
      ],
      "description": "15 Button 组件",
      "version": "1.0.0",
      "htmlContent": "<div class=\"comp-15-button-container\"><button class=\"button\" data-text=\"Awesome\"><span class=\"actual-text\">&nbsp;uiverse&nbsp;</span><span aria-hidden=\"true\" class=\"hover-text\">&nbsp;uiverse&nbsp;</span></button></div>",
      "cssContent": ".comp-15-button-container{position: relative;overflow: hidden} .comp-15-button-container .button{margin: 0;height: auto;background: transparent;padding: 0;border: none;cursor: pointer} .comp-15-button-container .button{--border-right: 6px;--text-stroke-color: rgba(255,255,255,0.6);--animation-color: #37FF8B;--fs-size: 2em;letter-spacing: 3px;text-decoration: none;font-size: var(--fs-size);font-family: \"Arial\";position: relative;text-transform: uppercase;color: transparent;-webkit-text-stroke: 1px var(--text-stroke-color)} .comp-15-button-container .hover-text{position: absolute;box-sizing: border-box;content: attr(data-text);color: var(--animation-color);width: 0%;inset: 0;border-right: var(--border-right) solid var(--animation-color);overflow: hidden;transition: 0.5s;-webkit-text-stroke: 1px var(--animation-color)} .comp-15-button-container .button:hover .hover-text{width: 100%;filter: drop-shadow(0 0 23px var(--animation-color)) }"
    }
  },
  {
    "category": "buttons",
    "record": {
      "id": "20-button",
      "title": "20 Button",
      "author": "开发者",
      "type": "html",
      "framework": "vanilla",
      "tags": [
        "button"
      ],
      "description": "20 Button 组件",
      "version": "1.0.0",
      "htmlContent": "<div class=\"comp-20-button-container\"><button class=\"learn-more\"><span class=\"circle\" aria-hidden=\"true\"><span class=\"icon arrow\"></span></span><span class=\"button-text\">Learn More</span></button></div>",
      "cssContent": ".comp-20-button-container{position: relative;overflow: hidden} .comp-20-button-container button{position: relative;display: inline-block;cursor: pointer;outline: none;border: 0;vertical-align: middle;text-decoration: none;background: transparent;padding: 0;font-size: inherit;font-family: inherit} .comp-20-button-container button.learn-more{width: 12rem;height: auto} .comp-20-button-container button.learn-more .circle{transition: all 0.45s cubic-bezier(0.65,0,0.076,1);position: relative;display: block;margin: 0;width: 3rem;height: 3rem;background: #282936;border-radius: 1.625rem} .comp-20-button-container button.learn-more .circle .icon{transition: all 0.45s cubic-bezier(0.65,0,0.076,1);position: absolute;top: 0;bottom: 0;margin: auto;background: #fff} .comp-20-button-container button.learn-more .circle .icon.arrow{transition: all 0.45s cubic-bezier(0.65,0,0.076,1);left: 0.625rem;width: 1.125rem;height: 0.125rem;background: none} .comp-20-button-container button.learn-more .circle .icon.arrow::before{position: absolute;content: \"\";top: -0.29rem;right: 0.0625rem;width: 0.625rem;height: 0.625rem;border-top: 0.125rem solid #fff;border-right: 0.125rem solid #fff;transform: rotate(45deg)} .comp-20-button-container button.learn-more .button-text{transition: all 0.45s cubic-bezier(0.65,0,0.076,1);position: absolute;top: 0;left: 0;right: 0;bottom: 0;padding: 0.75rem 0;margin: 0 0 0 1.85rem;color: #282936;font-weight: 700;line-height: 1.6;text-align: center;text-transform: uppercase} .comp-20-button-container button:hover .circle{width: 100%} .comp-20-button-container button:hover .circle .icon.arrow{background: #fff;transform: translate(1rem,0)} .comp-20-button-container button:hover .button-text{color: #fff}"
    }
  },
  {
    "category": "buttons",
    "record": {
      "id": "21-button",
      "title": "21 Button",
      "author": "开发者",
      "type": "html",
      "framework": "vanilla",
      "tags": [
        "button"
      ],
      "description": "21 Button 组件",
      "version": "1.0.0",
      "htmlContent": "<div class=\"comp-21-button-container\"><ul class=\"wrapper\"><li class=\"icon facebook\"><span class=\"tooltip\">Facebook</span><svg viewBox=\"0 0 320 512\" height=\"1.2em\" fill=\"currentColor\" xmlns=\"http://www.w3.org/2000/svg\" ><path d=\"M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z\" ></path></svg></li><li class=\"icon twitter\"><span class=\"tooltip\">Twitter</span><svg height=\"1.8em\" fill=\"currentColor\" viewBox=\"0 0 48 48\" xmlns=\"http://www.w3.org/2000/svg\" class=\"twitter\" ><path d=\"M42,12.429c-1.323,0.586-2.746,0.977-4.247,1.162c1.526-0.906,2.7-2.351,3.251-4.058c-1.428,0.837-3.01,1.452-4.693,1.776C34.967,9.884,33.05,9,30.926,9c-4.08,0-7.387,3.278-7.387,7.32c0,0.572,0.067,1.129,0.193,1.67c-6.138-0.308-11.582-3.226-15.224-7.654c-0.64,1.082-1,2.349-1,3.686c0,2.541,1.301,4.778,3.285,6.096c-1.211-0.037-2.351-0.374-3.349-0.914c0,0.022,0,0.055,0,0.086c0,3.551,2.547,6.508,5.923,7.181c-0.617,0.169-1.269,0.263-1.941,0.263c-0.477,0-0.942-0.054-1.392-0.135c0.94,2.902,3.667,5.023,6.898,5.086c-2.528,1.96-5.712,3.134-9.174,3.134c-0.598,0-1.183-0.034-1.761-0.104C9.268,36.786,13.152,38,17.321,38c13.585,0,21.017-11.156,21.017-20.834c0-0.317-0.01-0.633-0.025-0.945C39.763,15.197,41.013,13.905,42,12.429\" ></path></svg></li><li class=\"icon instagram\"><span class=\"tooltip\">Instagram</span><svg xmlns=\"http://www.w3.org/2000/svg\" height=\"1.2em\" fill=\"currentColor\" class=\"bi bi-instagram\" viewBox=\"0 0 16 16\" ><path d=\"M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.917 3.917 0 0 0-1.417.923A3.927 3.927 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.916 3.916 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.926 3.926 0 0 0-.923-1.417A3.911 3.911 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0h.003zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599.28.28.453.546.598.92.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.47 2.47 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.478 2.478 0 0 1-.92-.598 2.48 2.48 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233 0-2.136.008-2.388.046-3.231.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92.28-.28.546-.453.92-.598.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045v.002zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92zm-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217zm0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334z\" ></path></svg></li></ul></div>",
      "cssContent": ".comp-21-button-container{position: relative;overflow: hidden} .comp-21-button-container .wrapper{display: inline-flex;list-style: none;height: 120px;width: 100%;padding-top: 40px;font-family: \"Poppins\",sans-serif;justify-content: center} .comp-21-button-container .wrapper .icon{position: relative;background: #fff;border-radius: 50%;margin: 10px;width: 50px;height: 50px;font-size: 18px;display: flex;justify-content: center;align-items: center;flex-direction: column;box-shadow: 0 10px 10px rgba(0,0,0,0.1);cursor: pointer;transition: all 0.2s cubic-bezier(0.68,-0.55,0.265,1.55)} .comp-21-button-container .wrapper .tooltip{position: absolute;top: 0;font-size: 14px;background: #fff;color: #fff;padding: 5px 8px;border-radius: 5px;box-shadow: 0 10px 10px rgba(0,0,0,0.1);opacity: 0;pointer-events: none;transition: all 0.3s cubic-bezier(0.68,-0.55,0.265,1.55)} .comp-21-button-container .wrapper .tooltip::before{position: absolute;content: \"\";height: 8px;width: 8px;background: #fff;bottom: -3px;left: 50%;transform: translate(-50%) rotate(45deg);transition: all 0.3s cubic-bezier(0.68,-0.55,0.265,1.55)} .comp-21-button-container .wrapper .icon:hover .tooltip{top: -45px;opacity: 1;visibility: visible;pointer-events: auto} .wrapper .icon:hover span,.comp-21-button-container .wrapper .icon:hover .tooltip{text-shadow: 0px -1px 0px rgba(0,0,0,0.1)} .wrapper .facebook:hover,.wrapper .facebook:hover .tooltip,.comp-21-button-container .wrapper .facebook:hover .tooltip::before{background: #1877f2;color: #fff} .wrapper .twitter:hover,.wrapper .twitter:hover .tooltip,.comp-21-button-container .wrapper .twitter:hover .tooltip::before{background: #1da1f2;color: #fff} .wrapper .instagram:hover,.wrapper .instagram:hover .tooltip,.comp-21-button-container .wrapper .instagram:hover .tooltip::before{background: #e4405f;color: #fff}"
    }
  },
  {
    "category": "cards",
    "record": {
      "id": "1-cards",
      "title": "1 Cards",
      "author": "开发者",
      "type": "html",
      "framework": "vanilla",
      "tags": [
        "card"
      ],
      "description": "1 Cards 组件",
      "version": "1.0.0",
      "htmlContent": "<div class=\"comp-1-cards-container\"><div class=\"card\"><div class=\"content\"><div class=\"back\"><div class=\"back-content\"><svg stroke=\"#ffffff\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 50 50\" height=\"50px\" width=\"50px\" fill=\"#ffffff\"><g stroke-width=\"0\" id=\"SVGRepo_bgCarrier\"></g><g stroke-linejoin=\"round\" stroke-linecap=\"round\" id=\"SVGRepo_tracerCarrier\"></g><g id=\"SVGRepo_iconCarrier\"><path d=\"M20.84375 0.03125C20.191406 0.0703125 19.652344 0.425781 19.21875 1.53125C18.988281 2.117188 18.5 3.558594 18.03125 4.9375C17.792969 5.636719 17.570313 6.273438 17.40625 6.75C17.390625 6.796875 17.414063 6.855469 17.40625 6.90625C17.398438 6.925781 17.351563 6.949219 17.34375 6.96875L17.25 7.25C18.566406 7.65625 19.539063 8.058594 19.625 8.09375C22.597656 9.21875 28.351563 11.847656 33.28125 16.78125C38.5 22 41.183594 28.265625 42.09375 30.71875C42.113281 30.761719 42.375 31.535156 42.75 32.84375C42.757813 32.839844 42.777344 32.847656 42.78125 32.84375C43.34375 32.664063 44.953125 32.09375 46.3125 31.625C47.109375 31.351563 47.808594 31.117188 48.15625 31C49.003906 30.714844 49.542969 30.292969 49.8125 29.6875C50.074219 29.109375 50.066406 28.429688 49.75 27.6875C49.605469 27.347656 49.441406 26.917969 49.25 26.4375C47.878906 23.007813 45.007813 15.882813 39.59375 10.46875C33.613281 4.484375 25.792969 1.210938 22.125 0.21875C21.648438 0.0898438 21.234375 0.0078125 20.84375 0.03125 Z M 16.46875 9.09375L0.0625 48.625C-0.09375 48.996094 -0.00390625 49.433594 0.28125 49.71875C0.472656 49.910156 0.738281 50 1 50C1.128906 50 1.253906 49.988281 1.375 49.9375L40.90625 33.59375C40.523438 32.242188 40.222656 31.449219 40.21875 31.4375C39.351563 29.089844 36.816406 23.128906 31.875 18.1875C27.035156 13.34375 21.167969 10.804688 18.875 9.9375C18.84375 9.925781 17.8125 9.5 16.46875 9.09375 Z M 17 16C19.761719 16 22 18.238281 22 21C22 23.761719 19.761719 26 17 26C15.140625 26 13.550781 24.972656 12.6875 23.46875L15.6875 16.1875C16.101563 16.074219 16.550781 16 17 16 Z M 31 22C32.65625 22 34 23.34375 34 25C34 25.917969 33.585938 26.730469 32.9375 27.28125L32.90625 27.28125C33.570313 27.996094 34 28.949219 34 30C34 32.210938 32.210938 34 30 34C27.789063 34 26 32.210938 26 30C26 28.359375 26.996094 26.960938 28.40625 26.34375L28.3125 26.3125C28.117188 25.917969 28 25.472656 28 25C28 23.34375 29.34375 22 31 22 Z M 21 32C23.210938 32 25 33.789063 25 36C25 36.855469 24.710938 37.660156 24.25 38.3125L20.3125 39.9375C18.429688 39.609375 17 37.976563 17 36C17 33.789063 18.789063 32 21 32 Z M 9 34C10.65625 34 12 35.34375 12 37C12 38.65625 10.65625 40 9 40C7.902344 40 6.960938 39.414063 6.4375 38.53125L8.25 34.09375C8.488281 34.03125 8.742188 34 9 34Z\"></path></g></svg><strong>Hover Me</strong></div></div><div class=\"front\"><div class=\"img\"><div class=\"circle\"></div><div class=\"circle\" id=\"right\"></div><div class=\"circle\" id=\"bottom\"></div></div><div class=\"front-content\"><small class=\"badge\">Pasta</small><div class=\"description\"><div class=\"title\"><p class=\"title\"><strong>Spaguetti Bolognese</strong></p><svg fill-rule=\"nonzero\" height=\"15px\" width=\"15px\" viewBox=\"0,0,256,256\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" xmlns=\"http://www.w3.org/2000/svg\"><g style=\"mix-blend-mode: normal\" text-anchor=\"none\" font-size=\"none\" font-weight=\"none\" font-family=\"none\" stroke-dashoffset=\"0\" stroke-dasharray=\"\" stroke-miterlimit=\"10\" stroke-linejoin=\"miter\" stroke-linecap=\"butt\" stroke-width=\"1\" stroke=\"none\" fill-rule=\"nonzero\" fill=\"#20c997\"><g transform=\"scale(8,8)\"><path d=\"M25,27l-9,-6.75l-9,6.75v-23h18z\"></path></g></g></svg></div><p class=\"card-footer\"> 30 Mins &nbsp; | &nbsp; 1 Serving </p></div></div></div></div></div></div>",
      "cssContent": ".comp-1-cards-container{position: relative;overflow: hidden} .comp-1-cards-container .card{overflow: visible;width: 190px;height: 254px} .comp-1-cards-container .content{width: 100%;height: 100%;transform-style: preserve-3d;transition: transform 300ms;box-shadow: 0px 0px 10px 1px #000000ee;border-radius: 5px} .comp-1-cards-container .front,.back{background-color: #151515;position: absolute;width: 100%;height: 100%;backface-visibility: hidden;-webkit-backface-visibility: hidden;border-radius: 5px;overflow: hidden} .comp-1-cards-container .back{width: 100%;height: 100%;justify-content: center;display: flex;align-items: center;overflow: hidden} .comp-1-cards-container .back::before{position: absolute;content: ' ';display: block;width: 160px;height: 100%;background: linear-gradient(90deg,transparent,#ff9966,#ff9966,#ff9966,#ff9966,transparent);animation: rotation_481 5000ms infinite linear} .comp-1-cards-container .back-content{position: absolute;width: 99%;height: 99%;background-color: #151515;border-radius: 5px;color: white;display: flex;flex-direction: column;justify-content: center;align-items: center;gap: 30px} .comp-1-cards-container .card:hover .content{transform: rotateY(180deg)} @keyframes rotation_481{0%{transform: rotateZ(0deg)} 0%{transform: rotateZ(360deg)} } .comp-1-cards-container .front{transform: rotateY(180deg);color: white} .comp-1-cards-container .front .front-content{position: absolute;width: 100%;height: 100%;padding: 10px;display: flex;flex-direction: column;justify-content: space-between} .comp-1-cards-container .front-content .badge{background-color: #00000055;padding: 2px 10px;border-radius: 10px;backdrop-filter: blur(2px);width: fit-content} .comp-1-cards-container .description{box-shadow: 0px 0px 10px 5px #00000088;width: 100%;padding: 10px;background-color: #00000099;backdrop-filter: blur(5px);border-radius: 5px} .comp-1-cards-container .title{font-size: 11px;max-width: 100%;display: flex;justify-content: space-between} .comp-1-cards-container .title p{width: 50%} .comp-1-cards-container .card-footer{color: #ffffff88;margin-top: 5px;font-size: 8px} .comp-1-cards-container .front .img{position: absolute;width: 100%;height: 100%;object-fit: cover;object-position: center} .comp-1-cards-container .circle{width: 90px;height: 90px;border-radius: 50%;background-color: #ffbb66;position: relative;filter: blur(15px);animation: floating 2600ms infinite linear} .comp-1-cards-container #bottom{background-color: #ff8866;left: 50px;top: 0px;width: 150px;height: 150px;animation-delay: -800ms} .comp-1-cards-container #right{background-color: #ff2233;left: 160px;top: -80px;width: 30px;height: 30px;animation-delay: -1800ms} @keyframes floating{0%{transform: translateY(0px)} 50%{transform: translateY(10px)} 100%{transform: translateY(0px)} }"
    }
  },
  {
    "category": "cards",
    "record": {
      "id": "2-cards",
      "title": "2 Cards",
      "author": "开发者",
      "type": "html",
      "framework": "vanilla",
      "tags": [
        "card"
      ],
      "description": "2 Cards 组件",
      "version": "1.0.0",
      "htmlContent": "<div class=\"comp-2-cards-container\"><div class=\"cards\"><div class=\"card red\"><p class=\"tip\">Hover Me</p><p class=\"second-text\">Lorem Ipsum</p></div><div class=\"card blue\"><p class=\"tip\">Hover Me</p><p class=\"second-text\">Lorem Ipsum</p></div><div class=\"card green\"><p class=\"tip\">Hover Me</p><p class=\"second-text\">Lorem Ipsum</p></div></div></div>",
      "cssContent": ".comp-2-cards-container{position: relative;overflow: hidden} .comp-2-cards-container .cards{display: flex;flex-direction: column;gap: 15px} .comp-2-cards-container .cards .red{background-color: #f43f5e} .comp-2-cards-container .cards .blue{background-color: #3b82f6} .comp-2-cards-container .cards .green{background-color: #22c55e} .comp-2-cards-container .cards .card{display: flex;align-items: center;justify-content: center;flex-direction: column;text-align: center;height: 100px;width: 250px;border-radius: 10px;color: white;cursor: pointer;transition: 400ms} .comp-2-cards-container .cards .card p.tip{font-size: 1em;font-weight: 700} .comp-2-cards-container .cards .card p.second-text{font-size: .7em} .comp-2-cards-container .cards .card:hover{transform: scale(1.1,1.1)} .comp-2-cards-container .cards:hover > .card:not(:hover){filter: blur(10px);transform: scale(0.9,0.9)}"
    }
  },
  {
    "category": "cards",
    "record": {
      "id": "3-cards",
      "title": "3 Cards",
      "author": "开发者",
      "type": "html",
      "framework": "vanilla",
      "tags": [
        "card"
      ],
      "description": "3 Cards 组件",
      "version": "1.0.0",
      "htmlContent": "<div class=\"comp-3-cards-container\"><div class=\"card\"><svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path d=\"M20 5H4V19L13.2923 9.70649C13.6828 9.31595 14.3159 9.31591 14.7065 9.70641L20 15.0104V5ZM2 3.9934C2 3.44476 2.45531 3 2.9918 3H21.0082C21.556 3 22 3.44495 22 3.9934V20.0066C22 20.5552 21.5447 21 21.0082 21H2.9918C2.44405 21 2 20.5551 2 20.0066V3.9934ZM8 11C6.89543 11 6 10.1046 6 9C6 7.89543 6.89543 7 8 7C9.10457 7 10 7.89543 10 9C10 10.1046 9.10457 11 8 11Z\"></path></svg><div class=\"card__content\"><p class=\"card__title\">Card Title</p><p class=\"card__description\">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco.</p></div></div></div>",
      "cssContent": ".comp-3-cards-container{position: relative;overflow: hidden} .comp-3-cards-container .card{position: relative;width: 300px;height: 200px;background-color: #f2f2f2;border-radius: 10px;display: flex;align-items: center;justify-content: center;overflow: hidden;perspective: 1000px;box-shadow: 0 0 0 5px #ffffff80;transition: all 0.6s cubic-bezier(0.175,0.885,0.32,1.275)} .comp-3-cards-container .card svg{width: 48px;fill: #333;transition: all 0.6s cubic-bezier(0.175,0.885,0.32,1.275)} .comp-3-cards-container .card:hover{transform: scale(1.05);box-shadow: 0 8px 16px rgba(255,255,255,0.2)} .comp-3-cards-container .card__content{position: absolute;top: 0;left: 0;width: 100%;height: 100%;padding: 20px;box-sizing: border-box;background-color: #f2f2f2;transform: rotateX(-90deg);transform-origin: bottom;transition: all 0.6s cubic-bezier(0.175,0.885,0.32,1.275)} .comp-3-cards-container .card:hover .card__content{transform: rotateX(0deg)} .comp-3-cards-container .card__title{margin: 0;font-size: 24px;color: #333;font-weight: 700} .comp-3-cards-container .card:hover svg{scale: 0} .comp-3-cards-container .card__description{margin: 10px 0 0;font-size: 14px;color: #777;line-height: 1.4}"
    }
  },
  {
    "category": "cards",
    "record": {
      "id": "4-cards",
      "title": "4 Cards",
      "author": "开发者",
      "type": "html",
      "framework": "vanilla",
      "tags": [
        "card"
      ],
      "description": "4 Cards 组件",
      "version": "1.0.0",
      "htmlContent": "<div class=\"comp-4-cards-container\"><div class=\"card\"><p><span>HOVER ME</span></p><p><span>HOVER ME</span></p><p><span>HOVER ME</span></p></div></div>",
      "cssContent": ".comp-4-cards-container{position: relative;overflow: hidden} .comp-4-cards-container .card{width: 210px;height: 254px;border-radius: 4px;background: #212121;display: flex;gap: 5px;padding: .4em} .comp-4-cards-container .card p{height: 100%;flex: 1;overflow: hidden;cursor: pointer;border-radius: 2px;transition: all .5s;background: #212121;border: 1px solid #ff5a91;display: flex;justify-content: center;align-items: center} .comp-4-cards-container .card p:hover{flex: 4} .comp-4-cards-container .card p span{min-width: 14em;padding: .5em;text-align: center;transform: rotate(-90deg);transition: all .5s;text-transform: uppercase;color: #ff568e;letter-spacing: .1em} .comp-4-cards-container .card p:hover span{transform: rotate(0)}"
    }
  },
  {
    "category": "cards",
    "record": {
      "id": "5-cards",
      "title": "5 Cards",
      "author": "开发者",
      "type": "html",
      "framework": "vanilla",
      "tags": [
        "card"
      ],
      "description": "5 Cards 组件",
      "version": "1.0.0",
      "htmlContent": "<div class=\"comp-5-cards-container\"><div class=\"card\"><div class=\"card2\"></div></div></div>",
      "cssContent": ".comp-5-cards-container{position: relative;overflow: hidden} .comp-5-cards-container .card{width: 190px;height: 254px;background-image: linear-gradient(163deg,#00ff75 0%,#3700ff 100%);border-radius: 20px;transition: all .3s} .comp-5-cards-container .card2{width: 190px;height: 254px;background-color: #1a1a1a;border-radius: 0px;transition: all .2s} .comp-5-cards-container .card2:hover{transform: scale(0.98);border-radius: 20px} .comp-5-cards-container .card:hover{box-shadow: 0px 0px 30px 1px rgba(0,255,117,0.30)}"
    }
  },
  {
    "category": "checkboxes",
    "record": {
      "id": "1-checkbox",
      "title": "1 Checkbox",
      "author": "开发者",
      "type": "html",
      "framework": "vanilla",
      "tags": [
        "checkbox"
      ],
      "description": "1 Checkbox 组件",
      "version": "1.0.0",
      "htmlContent": "<div class=\"comp-1-checkbox-container\"><label class=\"burger\" for=\"burger\"><input type=\"checkbox\" id=\"burger\"><span></span><span></span><span></span></label></div>",
      "cssContent": ".comp-1-checkbox-container{position: relative;overflow: hidden} .comp-1-checkbox-container .burger{position: relative;width: 40px;height: 30px;background: transparent;cursor: pointer;display: block} .comp-1-checkbox-container .burger input{display: none} .comp-1-checkbox-container .burger span{display: block;position: absolute;height: 4px;width: 100%;background: black;border-radius: 9px;opacity: 1;left: 0;transform: rotate(0deg);transition: .25s ease-in-out} .comp-1-checkbox-container .burger span:nth-of-type(1){top: 0px;transform-origin: left center} .comp-1-checkbox-container .burger span:nth-of-type(2){top: 50%;transform: translateY(-50%);transform-origin: left center} .comp-1-checkbox-container .burger span:nth-of-type(3){top: 100%;transform-origin: left center;transform: translateY(-100%)} .comp-1-checkbox-container .burger input:checked ~ span:nth-of-type(1){transform: rotate(45deg);top: 0px;left: 5px} .comp-1-checkbox-container .burger input:checked ~ span:nth-of-type(2){width: 0%;opacity: 0} .comp-1-checkbox-container .burger input:checked ~ span:nth-of-type(3){transform: rotate(-45deg);top: 28px;left: 5px}"
    }
  },
  {
    "category": "checkboxes",
    "record": {
      "id": "2-checkbox",
      "title": "2 Checkbox",
      "author": "开发者",
      "type": "html",
      "framework": "vanilla",
      "tags": [
        "checkbox"
      ],
      "description": "2 Checkbox 组件",
      "version": "1.0.0",
      "htmlContent": "<div class=\"comp-2-checkbox-container\"><div id=\"checklist\"><input checked=\"\" value=\"1\" name=\"r\" type=\"checkbox\" id=\"01\"><label for=\"01\">Bread</label><input value=\"2\" name=\"r\" type=\"checkbox\" id=\"02\"><label for=\"02\">Cheese</label><input value=\"3\" name=\"r\" type=\"checkbox\" id=\"03\"><label for=\"03\">Coffee</label></div></div>",
      "cssContent": ".comp-2-checkbox-container{position: relative;overflow: hidden} .comp-2-checkbox-container #checklist{--background: #fff;--text: #414856;--check: #4f29f0;--disabled: #c3c8de;--width: 100px;--height: 180px;--border-radius: 10px;background: var(--background);width: var(--width);height: var(--height);border-radius: var(--border-radius);position: relative;box-shadow: 0 10px 30px rgba(65,72,86,0.05);padding: 30px 85px;display: grid;grid-template-columns: 30px auto;align-items: center;justify-content: center} .comp-2-checkbox-container #checklist label{color: var(--text);position: relative;cursor: pointer;display: grid;align-items: center;width: fit-content;transition: color 0.3s ease;margin-right: 20px} .comp-2-checkbox-container #checklist label::before,#checklist label::after{content: \"\";position: absolute} .comp-2-checkbox-container #checklist label::before{height: 2px;width: 8px;left: -27px;background: var(--check);border-radius: 2px;transition: background 0.3s ease} .comp-2-checkbox-container #checklist label:after{height: 4px;width: 4px;top: 8px;left: -25px;border-radius: 50%} .comp-2-checkbox-container #checklist input[type=\"checkbox\"]{-webkit-appearance: none;-moz-appearance: none;position: relative;height: 15px;width: 15px;outline: none;border: 0;margin: 0 15px 0 0;cursor: pointer;background: var(--background);display: grid;align-items: center;margin-right: 20px} .comp-2-checkbox-container #checklist input[type=\"checkbox\"]::before,#checklist input[type=\"checkbox\"]::after{content: \"\";position: absolute;height: 2px;top: auto;background: var(--check);border-radius: 2px} .comp-2-checkbox-container #checklist input[type=\"checkbox\"]::before{width: 0px;right: 60%;transform-origin: right bottom} .comp-2-checkbox-container #checklist input[type=\"checkbox\"]::after{width: 0px;left: 40%;transform-origin: left bottom} .comp-2-checkbox-container #checklist input[type=\"checkbox\"]:checked::before{animation: check-01 0.4s ease forwards} .comp-2-checkbox-container #checklist input[type=\"checkbox\"]:checked::after{animation: check-02 0.4s ease forwards} .comp-2-checkbox-container #checklist input[type=\"checkbox\"]:checked + label{color: var(--disabled);animation: move 0.3s ease 0.1s forwards} .comp-2-checkbox-container #checklist input[type=\"checkbox\"]:checked + label::before{background: var(--disabled);animation: slice 0.4s ease forwards} .comp-2-checkbox-container #checklist input[type=\"checkbox\"]:checked + label::after{animation: firework 0.5s ease forwards 0.1s} @keyframes move{50%{padding-left: 8px;padding-right: 0px} 100%{padding-right: 4px} } @keyframes slice{60%{width: 100%;left: 4px} 100%{width: 100%;left: -2px;padding-left: 0} } @keyframes check-01{0%{width: 4px;top: auto;transform: rotate(0)} 50%{width: 0px;top: auto;transform: rotate(0)} 51%{width: 0px;top: 8px;transform: rotate(45deg)} 100%{width: 5px;top: 8px;transform: rotate(45deg)} } @keyframes check-02{0%{width: 4px;top: auto;transform: rotate(0)} 50%{width: 0px;top: auto;transform: rotate(0)} 51%{width: 0px;top: 8px;transform: rotate(-45deg)} 100%{width: 10px;top: 8px;transform: rotate(-45deg)} } @keyframes firework{0%{opacity: 1;box-shadow: 0 0 0 -2px #4f29f0,0 0 0 -2px #4f29f0,0 0 0 -2px #4f29f0,0 0 0 -2px #4f29f0,0 0 0 -2px #4f29f0,0 0 0 -2px #4f29f0} 30%{opacity: 1} 100%{opacity: 0;box-shadow: 0 -15px 0 0px #4f29f0,14px -8px 0 0px #4f29f0,14px 8px 0 0px #4f29f0,0 15px 0 0px #4f29f0,-14px 8px 0 0px #4f29f0,-14px -8px 0 0px #4f29f0} }"
    }
  },
  {
    "category": "checkboxes",
    "record": {
      "id": "3-checkbox",
      "title": "3 Checkbox",
      "author": "开发者",
      "type": "html",
      "framework": "vanilla",
      "tags": [
        "checkbox"
      ],
      "description": "3 Checkbox 组件",
      "version": "1.0.0",
      "htmlContent": "<div class=\"comp-3-checkbox-container\"><label class=\"hamburger\"><input type=\"checkbox\"><svg viewBox=\"0 0 32 32\"><path class=\"line line-top-bottom\" d=\"M27 10 13 10C10.8 10 9 8.2 9 6 9 3.5 10.8 2 13 2 15.2 2 17 3.8 17 6L17 26C17 28.2 18.8 30 21 30 23.2 30 25 28.2 25 26 25 23.8 23.2 22 21 22L7 22\"></path><path class=\"line\" d=\"M7 16 27 16\"></path></svg></label></div>",
      "cssContent": ".comp-3-checkbox-container{position: relative;overflow: hidden} .comp-3-checkbox-container .hamburger{cursor: pointer} .comp-3-checkbox-container .hamburger input{display: none} .comp-3-checkbox-container .hamburger svg{height: 3em;transition: transform 600ms cubic-bezier(0.4,0,0.2,1)} .comp-3-checkbox-container .line{fill: none;stroke: white;stroke-linecap: round;stroke-linejoin: round;stroke-width: 3;transition: stroke-dasharray 600ms cubic-bezier(0.4,0,0.2,1),stroke-dashoffset 600ms cubic-bezier(0.4,0,0.2,1)} .comp-3-checkbox-container .line-top-bottom{stroke-dasharray: 12 63} .comp-3-checkbox-container .hamburger input:checked + svg{transform: rotate(-45deg)} .comp-3-checkbox-container .hamburger input:checked + svg .line-top-bottom{stroke-dasharray: 20 300;stroke-dashoffset: -32.42}"
    }
  },
  {
    "category": "checkboxes",
    "record": {
      "id": "4-checkbox",
      "title": "4 Checkbox",
      "author": "开发者",
      "type": "html",
      "framework": "vanilla",
      "tags": [
        "checkbox"
      ],
      "description": "4 Checkbox 组件",
      "version": "1.0.0",
      "htmlContent": "<div class=\"comp-4-checkbox-container\"><div class=\"heart-container\" title=\"Like\"><input type=\"checkbox\" class=\"checkbox\" id=\"Give-It-An-Id\"><div class=\"svg-container\"><svg viewBox=\"0 0 24 24\" class=\"svg-outline\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M17.5,1.917a6.4,6.4,0,0,0-5.5,3.3,6.4,6.4,0,0,0-5.5-3.3A6.8,6.8,0,0,0,0,8.967c0,4.547,4.786,9.513,8.8,12.88a4.974,4.974,0,0,0,6.4,0C19.214,18.48,24,13.514,24,8.967A6.8,6.8,0,0,0,17.5,1.917Zm-3.585,18.4a2.973,2.973,0,0,1-3.83,0C4.947,16.006,2,11.87,2,8.967a4.8,4.8,0,0,1,4.5-5.05A4.8,4.8,0,0,1,11,8.967a1,1,0,0,0,2,0,4.8,4.8,0,0,1,4.5-5.05A4.8,4.8,0,0,1,22,8.967C22,11.87,19.053,16.006,13.915,20.313Z\"></path></svg><svg viewBox=\"0 0 24 24\" class=\"svg-filled\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M17.5,1.917a6.4,6.4,0,0,0-5.5,3.3,6.4,6.4,0,0,0-5.5-3.3A6.8,6.8,0,0,0,0,8.967c0,4.547,4.786,9.513,8.8,12.88a4.974,4.974,0,0,0,6.4,0C19.214,18.48,24,13.514,24,8.967A6.8,6.8,0,0,0,17.5,1.917Z\"></path></svg><svg class=\"svg-celebrate\" width=\"100\" height=\"100\" xmlns=\"http://www.w3.org/2000/svg\"><polygon points=\"10,10 20,20\"></polygon><polygon points=\"10,50 20,50\"></polygon><polygon points=\"20,80 30,70\"></polygon><polygon points=\"90,10 80,20\"></polygon><polygon points=\"90,50 80,50\"></polygon><polygon points=\"80,80 70,70\"></polygon></svg></div></div></div>",
      "cssContent": ".comp-4-checkbox-container{position: relative;overflow: hidden} .comp-4-checkbox-container .heart-container{--heart-color: rgb(255,91,137);position: relative;width: 50px;height: 50px;transition: .3s} .comp-4-checkbox-container .heart-container .checkbox{position: absolute;width: 100%;height: 100%;opacity: 0;z-index: 20;cursor: pointer} .comp-4-checkbox-container .heart-container .svg-container{width: 100%;height: 100%;display: flex;justify-content: center;align-items: center} .heart-container .svg-outline,.comp-4-checkbox-container .heart-container .svg-filled{fill: var(--heart-color);position: absolute} .comp-4-checkbox-container .heart-container .svg-filled{animation: keyframes-svg-filled 1s;display: none} .comp-4-checkbox-container .heart-container .svg-celebrate{position: absolute;animation: keyframes-svg-celebrate .5s;animation-fill-mode: forwards;display: none;stroke: var(--heart-color);fill: var(--heart-color);stroke-width: 2px} .comp-4-checkbox-container .heart-container .checkbox:checked~.svg-container .svg-filled{display: block } .comp-4-checkbox-container .heart-container .checkbox:checked~.svg-container .svg-celebrate{display: block } @keyframes keyframes-svg-filled{0%{transform: scale(0)} 25%{transform: scale(1.2)} 50%{transform: scale(1);filter: brightness(1.5)} } @keyframes keyframes-svg-celebrate{0%{transform: scale(0)} 50%{opacity: 1;filter: brightness(1.5)} 100%{transform: scale(1.4);opacity: 0;display: none} }"
    }
  },
  {
    "category": "checkboxes",
    "record": {
      "id": "5-checkbox",
      "title": "5 Checkbox",
      "author": "开发者",
      "type": "html",
      "framework": "vanilla",
      "tags": [
        "checkbox"
      ],
      "description": "5 Checkbox 组件",
      "version": "1.0.0",
      "htmlContent": "<div class=\"comp-5-checkbox-container\"><label class=\"ui-bookmark\"><input type=\"checkbox\"><div class=\"bookmark\"><svg viewBox=\"0 0 32 32\"><g><path d=\"M27 4v27a1 1 0 0 1-1.625.781L16 24.281l-9.375 7.5A1 1 0 0 1 5 31V4a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4z\"></path></g></svg></div></label></div>",
      "cssContent": ".comp-5-checkbox-container{position: relative;overflow: hidden} .comp-5-checkbox-container .ui-bookmark{--icon-size: 24px;--icon-secondary-color: rgb(77,77,77);--icon-hover-color: rgb(97,97,97);--icon-primary-color: gold;--icon-circle-border: 1px solid var(--icon-primary-color);--icon-circle-size: 35px;--icon-anmt-duration: 0.3s} .comp-5-checkbox-container .ui-bookmark input{-webkit-appearance: none;-moz-appearance: none;appearance: none;display: none} .comp-5-checkbox-container .ui-bookmark .bookmark{width: var(--icon-size);height: auto;fill: var(--icon-secondary-color);cursor: pointer;-webkit-transition: 0.2s;-o-transition: 0.2s;transition: 0.2s;display: -webkit-box;display: -ms-flexbox;display: flex;-webkit-box-pack: center;-ms-flex-pack: center;justify-content: center;-webkit-box-align: center;-ms-flex-align: center;align-items: center;position: relative;-webkit-transform-origin: top;-ms-transform-origin: top;transform-origin: top} .comp-5-checkbox-container .bookmark::after{content: \"\";position: absolute;width: 10px;height: 10px;-webkit-box-shadow: 0 30px 0 -4px var(--icon-primary-color),30px 0 0 -4px var(--icon-primary-color),0 -30px 0 -4px var(--icon-primary-color),-30px 0 0 -4px var(--icon-primary-color),-22px 22px 0 -4px var(--icon-primary-color),-22px -22px 0 -4px var(--icon-primary-color),22px -22px 0 -4px var(--icon-primary-color),22px 22px 0 -4px var(--icon-primary-color);box-shadow: 0 30px 0 -4px var(--icon-primary-color),30px 0 0 -4px var(--icon-primary-color),0 -30px 0 -4px var(--icon-primary-color),-30px 0 0 -4px var(--icon-primary-color),-22px 22px 0 -4px var(--icon-primary-color),-22px -22px 0 -4px var(--icon-primary-color),22px -22px 0 -4px var(--icon-primary-color),22px 22px 0 -4px var(--icon-primary-color);border-radius: 50%;-webkit-transform: scale(0);-ms-transform: scale(0);transform: scale(0)} .comp-5-checkbox-container .bookmark::before{content: \"\";position: absolute;border-radius: 50%;border: var(--icon-circle-border);opacity: 0} .comp-5-checkbox-container .ui-bookmark:hover .bookmark{fill: var(--icon-hover-color)} .comp-5-checkbox-container .ui-bookmark input:checked + .bookmark::after{-webkit-animation: circles var(--icon-anmt-duration) cubic-bezier(0.175,0.885,0.32,1.275) forwards;animation: circles var(--icon-anmt-duration) cubic-bezier(0.175,0.885,0.32,1.275) forwards;-webkit-animation-delay: var(--icon-anmt-duration);animation-delay: var(--icon-anmt-duration)} .comp-5-checkbox-container .ui-bookmark input:checked + .bookmark{fill: var(--icon-primary-color);-webkit-animation: bookmark var(--icon-anmt-duration) forwards;animation: bookmark var(--icon-anmt-duration) forwards;-webkit-transition-delay: 0.3s;-o-transition-delay: 0.3s;transition-delay: 0.3s} .comp-5-checkbox-container .ui-bookmark input:checked + .bookmark::before{-webkit-animation: circle var(--icon-anmt-duration) cubic-bezier(0.175,0.885,0.32,1.275) forwards;animation: circle var(--icon-anmt-duration) cubic-bezier(0.175,0.885,0.32,1.275) forwards;-webkit-animation-delay: var(--icon-anmt-duration);animation-delay: var(--icon-anmt-duration)} @-webkit-keyframes bookmark{50%{-webkit-transform: scaleY(0.6);transform: scaleY(0.6)} 100%{-webkit-transform: scaleY(1);transform: scaleY(1)} } @keyframes bookmark{50%{-webkit-transform: scaleY(0.6);transform: scaleY(0.6)} 100%{-webkit-transform: scaleY(1);transform: scaleY(1)} } @-webkit-keyframes circle{from{width: 0;height: 0;opacity: 0} 90%{width: var(--icon-circle-size);height: var(--icon-circle-size);opacity: 1} to{opacity: 0} } @keyframes circle{from{width: 0;height: 0;opacity: 0} 90%{width: var(--icon-circle-size);height: var(--icon-circle-size);opacity: 1} to{opacity: 0} } @-webkit-keyframes circles{from{-webkit-transform: scale(0);transform: scale(0)} 40%{opacity: 1} to{-webkit-transform: scale(0.8);transform: scale(0.8);opacity: 0} } @keyframes circles{from{-webkit-transform: scale(0);transform: scale(0)} 40%{opacity: 1} to{-webkit-transform: scale(0.8);transform: scale(0.8);opacity: 0} }"
    }
  }
];
