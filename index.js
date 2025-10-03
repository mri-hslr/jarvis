
//for crud operations on file

import fs from 'fs'
function createfile(file,content){
    fs.writeFileSync(file,content);
    console.log("file has been created");
}

function readfile(file){
    if (!fs.existsSync(file)) {
        console.log(`File "${file}" does not exist.`);
        return;
    }
    const data =fs.readFileSync(file,'utf-8');
    console.log("content is ",data);
}

function deletefile(file){
    if (!fs.existsSync(file)) {
        console.log(`File "${file}" does not exist.`);
        return;
    }
    fs.unlinkSync(file)
    console.log("file is deleted");
}




// for opening websites

import open from 'open'
open('https://www.google.com')


//for opening files with default app
import {exec} from 'child_process'
import os from 'os'


function openfile(path){
    if(!fs.existsSync(path)){
        console.log("file does not exist");
    }
    else{
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
function openapp(appname){
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
openfile('notes.txt');
createfile('notes.txt','jarvis wake up, daddy is home')
readfile('notes.txt')
openapp('Chess')


