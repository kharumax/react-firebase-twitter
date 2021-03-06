import {tweetCommentsRef, tweetLikedUserRef, tweetRef, tweetsRef, userLikesTweetRef} from "../../config/firebase";
import {buildTweet, Tweet} from "../entities/Tweet";
import {User} from "../entities/User";
import {FirestoreTimestampToString, readNowTimestamp, uploadImage} from "../../utils/Utils";
import firebase from "firebase/app";
import {buildComment, Comment} from "../entities/Comment";

/*
* Data Structure
* posts -> likes -> userId
*                -> userId
*
*       -> comments -> data
*
* */
// type Tweets = Tweet[]

export const fetchTweets = async (currentUid: string): Promise<Tweet[]> => {
    try {
        const tweetDocs = tweetsRef.orderBy("timestamp","desc");
        const tweets = await fetchTweetsByOption(tweetDocs,currentUid);
        return Promise.resolve(tweets)
    } catch (e) {
        return Promise.reject(e)
    }
};

interface ITweetDetail {
    tweet: Tweet
    comments: Comment[]
}

export const fetchTweetDetail = async (tweetId: string,currentUid: string): Promise<ITweetDetail> => {
    try {
        const tweetDoc = await tweetRef(tweetId).get();
        const likeDocs = await tweetLikedUserRef(tweetId).get();
        const commentDocs = await tweetCommentsRef(tweetId).get();
        const isLiked = likeDocs.docs.filter(doc => {
            return doc.id == currentUid
        }).length != 0;
        const tweet = buildTweet(tweetDoc.data()!,likeDocs.size,commentDocs.size,isLiked);
        const comments: Comment[] = commentDocs.docs.map(doc => {
            return buildComment(doc.data())
        });
        const tweetDetail: ITweetDetail = {tweet: tweet,comments: comments};
        return Promise.resolve(tweetDetail)
    } catch (e) {
        return Promise.reject(e);
    }
};

export const fetchTweetsByOption = async (ref: firebase.firestore.Query<firebase.firestore.DocumentData>,currentUid: string): Promise<Tweet[]> => {
    try {
        const tweetDocs = await ref.get();
        let tweets: Tweet[] = [];
        // ここでPromiseを返す配列を作成する。Promise自体を返すわけではないので await を利用しても意味がない
        const tweetsPromises = tweetDocs.docs.map(async doc => {
            const likeDocs = await doc.ref.collection("likes").get();
            const commentDocs = await doc.ref.collection("comments").get();
            const isLikedDocs = likeDocs.docs.filter(doc => {
                return doc.id == currentUid
            });
            const isLiked = isLikedDocs.length != 0; // isLikedDocsはいいねしたユーザーのUidのDocumentを取得する
            const tweet = buildTweet(doc.data(),likeDocs.size,commentDocs.size,isLiked);
            tweets = tweets.concat(tweet)
        });
        // ここで配列のPromiseをそれぞれ非同期で実行する。それぞれ Promise を返すので await で処理が終了するまで待つ
        await Promise.all(tweetsPromises);
        return Promise.resolve(tweets)
    } catch (e) {
        return Promise.reject(e)
    }
};

export const sendTweet = async (user: User,file: File | null,text: string): Promise<Tweet> => {
    let url = "";
    if (file != null) {
        url = await uploadImage(file,"tweet",user.uid)
    }
    try {
        const tweetRef = tweetsRef.doc();
        const data = { id: tweetRef.id,uid: user.uid,fullname: user.fullname,username: user.username,
            profileImageUrl: user.profileImageUrl,text: text,imageUrl: url,timestamp: readNowTimestamp()};
        await tweetRef.set(data);
        const tweet: Tweet = { id: data.id,uid: data.uid,fullname: data.fullname,username: data.username,
            profileImageUrl: data.profileImageUrl,text: data.text,imageUrl: url,timestamp: FirestoreTimestampToString(new Date()),likes: 0,comments: 0,isLiked: false};
        return  Promise.resolve(tweet)
    } catch (e) {
        console.log(`DEBUG: ${e} at sendTweet`);
        return Promise.reject(e)
    }
};

export const sendLikeTweet = async (currentUid: string,tweetId: string): Promise<void> => {
    try {
        await userLikesTweetRef(currentUid).doc(tweetId).set({});
        await tweetLikedUserRef(tweetId).doc(currentUid).set({});
        return Promise.resolve();
    } catch (e) {
        return Promise.reject(e);
    }
};

export const sendUnLikeTweet = async (currentUid: string,tweetId: string): Promise<void> => {
    try {
        await userLikesTweetRef(currentUid).doc(tweetId).delete();
        await tweetLikedUserRef(tweetId).doc(currentUid).delete();
        return Promise.resolve();
    } catch (e) {
        return Promise.reject(e);
    }
};




