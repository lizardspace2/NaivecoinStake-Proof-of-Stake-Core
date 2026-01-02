
import { getPublicFromWallet, getPrivateFromWallet, getUnspentTxOuts } from './blockchain';
import { createTransaction } from './wallet';
import { validateTransaction } from './transaction';
import * as _ from 'lodash';

const run = () => {
    try {
        console.log('--- Transaction Debugger ---');
        const privateKey = getPrivateFromWallet();
        const publicKey = getPublicFromWallet();
        const unspentTxOuts = getUnspentTxOuts();

        console.log(`Public Key (Address): ${publicKey.substring(0, 20)}...`);
        console.log(`Unspent UTXOs count: ${unspentTxOuts.length}`);

        const receiverAddress = '3dae41080894a7977710b853ddf3e2551a3bccbd545e53fea99fbdd12c9e0c8daceaaff265411ebcd8d7c3eb975160cb16a661cbbb43c1b1a8811b2f58f4c5fd227fe112d6d38d692caff3898726c08475354feda78787729c5ac0002887205abce7276492b4b4fc465b16a66e14fa5d6d2c9a3b8702a98745b18278b437cb5fefe83a17ba4095354547ace0fe4be61ce9fe6670d9231d5e3d762b4565f31fb8205c5a42b0332500f75801f3765ee1955eefcc92a41c6b1c30c06b74eca14fc4c491b441861575a7fdc57f2b94892f114306781ed2e0dbf3b199965d06688ded725831210bda3bbb6ca7eca8b19ade1effc691e4132b9bf3b858136753ce6ab107398bc1697bc135ced8c15e24ec6423ac4e63d21dddbba7ec2df32cd6c211f145ce45bfab889adc3c0d656c24f79ad396f264b5b54ad0056e7d72f25772c94e189fdf59f5f8d7ea43823a97827b8664d91705bdcf48e5d9be95f92dd442a36366c50537e19dfb29cff413d57dae883cdd989b40b2fbf2d3b5b1e5b142ebc42e466c0d45ee262bf27c30d7eaee7ae630a566341ab8caa9a92ba9233c10fa7523597be42778269c9e85e103b254b565c3f1ffdc2dce33926d5fb7396ddd0a5533c53dde647f5b8d70c851936f2dc19f8a15754758678d3422f66d79418c9deb7c51fd3323ce1b52314be0ed2bc0a82bf8290e99983fc4b2cc83da2134fd2ccd7b61d6de416c5c936ae21405554913a704c2a22f247804536c04edfe14775a11c6223c25b013ba52ad3ab2239841bca24a38de449eb1b188d3cc65c5c876bb271c25ae39c9cf7509344499ce9dea218c113ab483a19d85f2f573e8b81cad96498d7436f70a35314a26708ae07d6849388366b796e571d490cba6ffe165cec17918020ce4a957d1c4c6c602d0b0a1f938a92b08adfd11909d712eab9dc6967bc02e5bef6114e80391d91335c170220857eff6c0f447201051d89baad4e1880fbf550d95ca8c81256c52be08104247e61b206af1f070b5da93754c22fdfc6dfc90ff1f2cd5c07ac613720e8043a1fcd8f5c7ad88c0d2e565d4593398e4145e0ecee14e2eb85a52707fa9d1331ec890dbe1b7c719e99260d63c8ec68c98b5e7a13bacb26215f5d733a677646f462dae9c55a33ddaa967029364bc4e6e0293de03e2bea6c99cb928e2ea32cc1c93383bf1d1add4b54ebef98aa018ae64b8a05c84fb18bfc485343bef542bfd11c6b72f4b375669332f694d4ae7194269d79f7cbdbdbdab8fdeec8a6b5fa1ddc3ad487253a8a4d108d4df683765f7f70e6d16ad1ccef21b2da44cb93945ec677b89e425657dfc5f544b437bdef733eb8a91dc1cf0fa98b495243c4a4a5bfc68bb7b2688ab1517b12baffdf3c84a6cac2b6c6905360ff5f4b3ad6138b585569d1f9c779bfd1e8cabe7adb179fa808915978b4ce5d0a639a3d16ea31cfab472b6917aac8aef810145218a2ebdee3f9fbb709a9d4d37f4bf627d49a536c1eaba8e15aa08b92f1f76732bef47ac171598a80be1f660eefa81015b71666aed7d42cec1a67c4aea7d4a2f636a029d1fd687ae59c047655bb88b6d38c3519074c0c4f724f62ca8d4c12898365ae6260664d781b1fc1907abc24ed9488296c2e36cbd17ae79fe0fea63d699755caf18d61ab206a2ca260cc70dd3afc31a5939c0cdbd09f4b765547c3167308650a891f58cd73ae6507d400a8f18dcef630e58653e0d7f7065c3a755098665c10a258344a9c615cc1a4f831ef7614407dd068a384e48344c9fc351c7801d2cfb688cd472d30d6cdaf5414f32e43cd206901fde94b0d07c374998fd5fe592407f425f8827622de6c9be7002f8b68e87a1a11adde205e1be038c8d49209b0fa29fd23367f643aff2d12e418bc99b3bda65b7591b0a85ec61742763570d6ece7f6e02469ea8090be86d957ee7da52156fc998dcaabb99519fe9b0d92a3680dea08be76ff930de6acecf77edbb97fff30bb28a43cdb586e51a51eb98cb9f4cdc03e537ea46414c4db8e276778caf205c0d3c7e6e386854a48a343a6be3223f5d9bc96c2f8aa346137fdc03316aba7586';
        const amount = 1000;

        console.log(`Creating transaction for ${amount} coins...`);
        const tx = createTransaction(receiverAddress, amount, privateKey, unspentTxOuts, []);
        console.log('Transaction created:', JSON.stringify(tx, null, 2));

        console.log('Validating transaction...');
        const isValid = validateTransaction(tx, unspentTxOuts);

        if (isValid) {
            console.log('SUCCESS: Transaction is valid!');
        } else {
            console.log('FAILURE: Transaction is invalid!');
        }

    } catch (e) {
        console.error('ERROR:', e.message);
    }
};

run();
