/*#############################################################

Name: BeautifulJapanese[flashkit]
Version: 0.50
Author: Yasuhiro Monta [ideaman's]
URL: http://www.ideamans.com/

#############################################################*/

//初期設定->beautifulJapanese.swfをアップロードした場所に応じて、下記のパスを書き換えてください。

baseSwfFile = 'common/swf/beautifulJapanese.swf';
//例）baseSwfFile = '/common/swf/beautifulJapanese.swf';

function replaceFonts( targetId, targetTag, targetSwf, flaWidth, fontSize, fontLineHeight, charLimit, fontColorNormal, 	fontColorLink, fontColorHover ){
	//変換モードを判定する
	if ( targetTag == null || targetTag == '0' || targetTag == '' ){
		//個別変換モード
		var textValue = document.getElementById(targetId).childNodes[0].nodeValue;
		var textHref = 'none';
		var textTarget = 'none';
		var targetObj = document.getElementById(targetId);
		//リンクの有無を確認する
		if ( textValue == null ){
			//個別変換モード_リンク有
			textValue = document.getElementById(targetId).childNodes[0].childNodes[0].nodeValue;
			textHref = document.getElementById(targetId).childNodes[0].getAttribute("href");
			textTarget = document.getElementById(targetId).childNodes[0].getAttribute("target");
			targetObj = document.getElementById(targetId).childNodes[0];
		}
		writeSWF( targetId, targetSwf, targetObj, flaWidth, fontSize, fontLineHeight, charLimit, fontColorNormal, 
			fontColorLink, fontColorHover, textValue, textHref, textTarget );
	}
	else {
		var body_nodes = document.getElementById(targetId).getElementsByTagName(targetTag);
		for (var j = 0; j < body_nodes.length; j++) {
			//一括変換モード
			textValue = body_nodes[j].childNodes[0].nodeValue;
			textHref = 'none';
			textTarget = 'none';
			targetObj = body_nodes[j];
			if (textValue == null){
				//一括変換モード_リンク有
				textValue = body_nodes[j].childNodes[0].childNodes[0].nodeValue;
				textHref = body_nodes[j].childNodes[0].getAttribute("href");
				textTarget = body_nodes[j].childNodes[0].getAttribute("target");
				targetObj = body_nodes[j].childNodes[0];
			}
			writeSWF( targetId, targetSwf, targetObj, flaWidth, fontSize, fontLineHeight, charLimit, fontColorNormal, 
				fontColorLink, fontColorHover, textValue, textHref, textTarget );
		}
	}
}

//flashムービー表示
function writeSWF( targetId, targetSwf, targetObj, flaWidth, fontSize, fontLineHeight, charLimit, fontColorNormal, 
	fontColorLink, fontColorHover, textValue, textHref, textTarget ){
	//文字数から行数、ムービー高さを算出
	calFlaHeight(textValue, charLimit, fontSize, fontLineHeight);

	//utf-8でURLエンコード（firefox対応）
	encodeValue(textValue);

	//flashに送る変数
	sendParam = "?textValue=" + encodeTextValueUnit;
	sendParam += "&textHref=" + textHref;
	sendParam += "&textTarget=" + textTarget;
	sendParam += "&fontSize=" + fontSize;
	sendParam += "&fontLineHeight=" + fontLineHeight;
	sendParam += "&fontColorNormal=" + fontColorNormal;
	sendParam += "&fontColorLink=" + fontColorLink;
	sendParam += "&fontColorHover=" + fontColorHover;
	sendParam += "&targetSwf=" + targetSwf;
	sendParam += "&flaHeight=" + flaHeight;
	sendParam += "&flaWidth=" + flaWidth;
	swfCode = "<EMBED src="+ baseSwfFile + sendParam;
	swfCode += " quality=high wmode=transparent bgcolor=#FFFFFF";
	swfCode += " WIDTH=" + flaWidth;
	swfCode += " HEIGHT=" + flaHeight;
	swfCode += " NAME=" + targetId;
	swfCode += " ALIGN=top scale=noscale salign=lt wmode=transparent";
	swfCode += " TYPE=application/x-shockwave-flash";
	swfCode += " PLUGINSPAGE=http://www.macromedia.com/go/getflashplayer></EMBED>";

	targetObj.innerHTML = swfCode;
	return;
}

//文字数が一行制限文字数を超えた場合は、行数分ムービーの高さを追加させる（全角を2文字とする）
function calFlaHeight( textValue, charLimit, fontSize, fontLineHeight ){
	var fontSize = Number(fontSize);
	var fontLineHeight = Number(fontLineHeight);
	var rowHeight = fontSize + fontLineHeight;
	var len = 0;
	var textValue2 = escape(textValue);

	for (var i = 0; i < textValue2.length; i++, len++) {
		if (textValue2.charAt(i) == "%") {
			if (textValue2.charAt(++i) == "u") {
				i += 3;
				len++;
			}
			i++;
		}
	}
	if (len >= charLimit){
		rows = Math.ceil(len/charLimit);
		flaHeight = rowHeight * rows;
	} else {
		flaHeight = rowHeight;
	}
	return flaHeight;
}


//utf-8でURLエンコード（firefox対応）
function encodeValue( textValue ){
	chCode = "";
	encodeTextValue = "";
	num = "";
	encodeTextValueUnit = "";

	for (var ii = 0; ii < textValue.length; ii++) {
		chCode = textValue.charCodeAt(ii);
		if (chCode <= 0x7f) {
			encodeTextValue += textValue.charAt(ii);
		} else if (chCode >= 0x80 && chCode <= 0x7ff) {
			encodeTextValue += String.fromCharCode(((chCode >> 6) & 0x1f) | 0xc0);
			encodeTextValue += String.fromCharCode((chCode & 0x3f) | 0x80);
		} else {
			encodeTextValue += String.fromCharCode((chCode >> 12) | 0xe0);
			encodeTextValue += String.fromCharCode(((chCode >> 6) & 0x3f) | 0x80);
			encodeTextValue += String.fromCharCode((chCode & 0x3f) | 0x80);
		}
	}
	for (var jj = 0; jj < encodeTextValue.length; jj++) {
		chCode = encodeTextValue.charCodeAt(jj);
		if ((chCode >= 0x30 && chCode <= 0x39) || (chCode >= 0x40 && chCode <= 0x5A) ||
			(chCode >= 0x61 && chCode <= 0x7A) || (chCode == 0x2A) ||
			(chCode == 0x2D) || (chCode == 0x2E) || (chCode == 0x5F)) {
			encodeTextValueUnit += encodeTextValue.charAt(jj);
		} else {
			num = chCode.toString(16).toUpperCase();
			encodeTextValueUnit += "%" + (num.length == 1 ? "0" + num : num);
		}
	}
	return encodeTextValueUnit;
}

