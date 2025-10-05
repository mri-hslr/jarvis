//voice assistant
//promise version for speak function
import say from 'say';
function speak(text,voice=null,speed=1.0){
    return new Promise((resolve,reject)=>{
        say.speak(text,voice,speed,err=>{
            if(err){
                return reject(err);
            }
            resolve();
        })
    })
}

//for crud operations on file

import fs from 'fs'
async function createfile(file,content){
    fs.writeFileSync(file,content);
    console.log("file has been created");
    await speak(`"${file}" has been created `);
}

async function readfile(file){
    if (!fs.existsSync(file)) {
        console.log(`File "${file}" does not exist.`);
        await speak(`file "${file}" does not exist`)
        return;
    }
    const data =fs.readFileSync(file,'utf-8');
    console.log("content is ",data);
    await speak(`reading file "${file}".it says "${data}"`);
}
async function deletefile(file){
    if (!fs.existsSync(file)) {
        console.log(`File "${file}" does not exist.`);
        await speak(`"${file}" has been deleted`);
        return;
    }
    fs.unlinkSync(file)
    console.log("file is deleted");
}




// for opening websites

import open from 'open'
async function openwebsite(url){
    await speak(`opening "${url}"`);
    await open(url);
    console.log("website opened");
}



//for opening files with default app
import {exec} from 'child_process'
import os from 'os'


async function openfile(path){
    if(!fs.existsSync(path)){
        console.log("file does not exist");
        await speak("file does not exist");
    }
    else{
        await speak(`opening file"${path}"`);
        if(os.platform()==='darwin'){
            exec(`open "${path}"`)// for macos
        }
        else if(os.platform()==='win32'){
            exec(`open "" "${path}"`)// for windows
        }
        else{
            exec(`xdg-open "${path}" `)// for linux
        }
    }
}
// to open any app
async function openapp(appname){
    await speak(`opening "${appname}"`);
    if(os.platform()==='darwin'){
        exec(`open -a "${appname}"`,(error)=>{
            if(error){
                console.log("failed opening an app");
            }
            else{
                console.log("opened  app successfully");
            }
        } )
    }
}
async function jarvisDemo(){
    await openfile('notes.txt');
    await createfile('notes.txt','jarvis wake up, daddy bought some gifts for you')
    await readfile('notes.txt')
    await openapp('Chess')
    await openwebsite('https://www.youtube.com/');
}
jarvisDemo();
