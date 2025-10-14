import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigw from "aws-cdk-lib/aws-apigateway";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class HogwartsNotificationServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'HogwartsNotificationServiceQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });

    const code = lambda.Code.fromAsset("src");

    // lambda function resource
    const myFunction = new lambda.Function(this, "HelloWorldFunction", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "lambda/index.handler",
      code: code,
    });

    // lambda function url resource
    const myFunctionUrl = myFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    // CloudFormation output for the url
    new cdk.CfnOutput(this, "myFunctionUrlOutput", {
      value: myFunctionUrl.url,
    });

    // API DEFINITION
    const api = new apigw.RestApi(this, "MyApiGateway", {
      restApiName: "MyServiceApi",
      deployOptions: {
        stageName: "dev",
      },
    });

    const notificationsResource = api.root.addResource("notifications");
    const notificationByRecipient =
      notificationsResource.addResource("{recipient}");
    notificationByRecipient.addMethod(
      "GET",
      new apigw.LambdaIntegration(myFunction)
    );

    notificationsResource.addMethod(
      "POST",
      new apigw.LambdaIntegration(myFunction)
    );
  }
}
