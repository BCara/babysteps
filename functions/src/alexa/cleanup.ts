import * as admin from 'firebase-admin';
import * as functionsV1 from 'firebase-functions/v1';

const REGION = 'australia-southeast1';

export const cleanupDeletedUser = functionsV1
  .region(REGION)
  .auth.user()
  .onDelete(async user => {
    const database = admin.firestore();
    const [accessTokens, refreshTokens, authorizationCodes] = await Promise.all([
      database.collection('alexaAccessTokens').where('userId', '==', user.uid).get(),
      database.collection('alexaRefreshTokens').where('userId', '==', user.uid).get(),
      database.collection('alexaOAuthCodes').where('userId', '==', user.uid).get(),
    ]);
    const references = [
      ...accessTokens.docs.map(document => document.ref),
      ...refreshTokens.docs.map(document => document.ref),
      ...authorizationCodes.docs.map(document => document.ref),
    ];

    for (let offset = 0; offset < references.length; offset += 400) {
      const batch = database.batch();
      references
        .slice(offset, offset + 400)
        .forEach(reference => batch.delete(reference));
      await batch.commit();
    }
  });
